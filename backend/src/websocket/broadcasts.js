/**
 * WebSocket Broadcast Handler
 * Manages event broadcasting to connected clients
 */

const logger = require('../utils/logger');
const listenerRegistry = require('./listenerRegistry');
const { emitWrapped, emitToRoom } = require('./eventWrapper');
const vlcService = require('../services/vlcService');

// ADD: Module-level tracking
const activeListeners = [];

/**
 * Helper function to add and track event listeners
 * @param {EventEmitter} service - Service instance
 * @param {string} event - Event name
 * @param {Function} handler - Event handler
 */
function addTrackedListener(service, event, handler) {
  const serviceName = service.constructor.name;

  // Add to service
  service.on(event, handler);

  // Track in both places
  activeListeners.push({ service, event, handler });
  listenerRegistry.trackListener(service, event, handler);

  logger.debug('Added tracked listener', {
    service: serviceName,
    event,
    totalListeners: service.listenerCount(event),
    activeCount: activeListeners.length
  });
}

/**
 * Setup service event listeners for broadcasting
 * @param {Server} io - Socket.io server instance
 * @param {Object} services - Service instances
 */
function setupBroadcastListeners(io, services) {
  const { sessionService, stateService, videoQueueService, offlineQueueService, transactionService } = services;

  // Session events - session:update replaces session:new/paused/resumed/ended
  // Per AsyncAPI contract and Decision #7 (send FULL resource, not deltas)
  addTrackedListener(sessionService, 'session:created', (session) => {
    // Broadcast session update to all clients
    emitWrapped(io, 'session:update', {
      id: session.id,              // Decision #4: 'id' field within resource
      name: session.name,
      startTime: session.startTime,
      endTime: session.endTime,
      status: session.status,      // 'active' for new session
      teams: session.teams || [],
      metadata: session.metadata || {}
    });

    // Initialize all currently connected devices into the new session
    // This handles devices that connected before session existed
    initializeSessionDevices(io, session);

    logger.info('Broadcasted session:update (created)', { sessionId: session.id, status: session.status });
  });

  addTrackedListener(sessionService, 'session:updated', (session) => {
    emitWrapped(io, 'session:update', {
      id: session.id,              // Decision #4: 'id' field within resource
      name: session.name,
      startTime: session.startTime,
      endTime: session.endTime,
      status: session.status,      // 'paused', 'active', or 'ended'
      teams: session.teams || [],
      metadata: session.metadata || {}
    });
    logger.info('Broadcasted session:update', { sessionId: session.id, status: session.status });
  });

  // Device events - broadcast device connections (centralized)
  // Handles BOTH WebSocket (GM) and HTTP (Player) device registrations
  // Replaces manual broadcast from gmAuth.js for consistency
  addTrackedListener(sessionService, 'device:updated', ({ device, isNew }) => {
    // Only broadcast device:connected for NEW devices that are CONNECTED
    // Skip: heartbeat updates (isNew=false), disconnect status changes (connectionStatus!='connected')
    if (isNew && device.connectionStatus === 'connected') {
      // Broadcast per AsyncAPI contract
      emitWrapped(io, 'device:connected', {
        deviceId: device.id,
        type: device.type,
        name: device.name,
        ipAddress: device.ipAddress,
        connectionTime: device.connectionTime
      });

      logger.info('Broadcasted device:connected', {
        deviceId: device.id,
        type: device.type,
        source: 'centralized'
      });
    }
  });

  addTrackedListener(sessionService, 'transaction:added', (transaction) => {
    // Enrich transaction with token data for frontend display
    const token = transactionService.getToken(transaction.tokenId);

    // Prepare payload per AsyncAPI contract (nested transaction object)
    const payload = {
      transaction: {
        id: transaction.id,
        tokenId: transaction.tokenId,
        teamId: transaction.teamId,
        deviceId: transaction.deviceId,
        mode: transaction.mode,  // AsyncAPI contract field (Decision #4)
        status: transaction.status,  // CRITICAL: accepted/duplicate/error status
        points: transaction.points,
        timestamp: transaction.timestamp,
        // Include token details for frontend display (optional per contract)
        memoryType: token?.memoryType || 'UNKNOWN',
        valueRating: token?.metadata?.rating || 0
      }
    };

    // Per contract: broadcast to session room only
    const session = sessionService.getCurrentSession();
    if (session) {
      emitToRoom(io, `session:${session.id}`, 'transaction:new', payload);
      logger.info('Broadcasted transaction:new to session', {
        transactionId: transaction.id,
        sessionId: session.id
      });
    } else {
      // Fallback: if no session, broadcast to all (shouldn't happen)
      emitWrapped(io, 'transaction:new', payload);
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

    emitToRoom(io, 'gm-stations', 'state:update', delta);

    logger.debug('Broadcasted state:update to GM stations', {
      deltaKeys: Object.keys(delta),
      gmStationCount: gmCount
    });
  });

  addTrackedListener(stateService, 'state:sync', (state) => {
    emitWrapped(io, 'state:sync', state);
    logger.info('Broadcasted state:sync');
  });

  // Full sync event (contract compliant)
  addTrackedListener(stateService, 'sync:full', (fullState) => {
    emitWrapped(io, 'sync:full', fullState);
    logger.info('Broadcasted sync:full', {
      hasSession: !!fullState.session,
      hasState: !!fullState.state,
      hasQueue: !!fullState.queue
    });
  });

  // Transaction/Score events - broadcast to GM stations only
  if (transactionService) {
    addTrackedListener(transactionService, 'score:updated', (teamScore) => {
      const payload = {
        teamId: teamScore.teamId,
        currentScore: teamScore.currentScore,
        baseScore: teamScore.baseScore,  // Use actual baseScore field from TeamScore
        bonusPoints: teamScore.bonusPoints || 0,
        tokensScanned: teamScore.tokensScanned,
        completedGroups: teamScore.completedGroups || [],
        lastUpdate: teamScore.lastUpdate
      };

      emitToRoom(io, 'gm-stations', 'score:updated', payload);
      logger.info('Broadcasted score:updated to GM stations', {
        teamId: teamScore.teamId,
        score: teamScore.currentScore,
        bonus: teamScore.bonusPoints || 0
      });
    });

    addTrackedListener(transactionService, 'group:completed', (data) => {
      const payload = {
        teamId: data.teamId,
        group: data.groupId,           // AsyncAPI: 'group' not 'groupId'
        bonusPoints: data.bonus,        // AsyncAPI: 'bonusPoints' not 'bonus'
        completedAt: new Date().toISOString()  // AsyncAPI: required timestamp
      };

      emitToRoom(io, 'gm-stations', 'group:completed', payload);
      logger.info('Broadcasted group:completed to GM stations', data);
    });

    addTrackedListener(transactionService, 'team:created', (data) => {
      const payload = {
        teamId: data.teamId
      };

      emitToRoom(io, 'gm-stations', 'team:created', payload);
      logger.info('Broadcasted team:created to GM stations', { teamId: data.teamId });
    });
  }

  // Video events (contract-compliant)
  addTrackedListener(videoQueueService, 'video:loading', (data) => {
    const payload = {
      status: 'loading',
      tokenId: data.tokenId,
      queueLength: (videoQueueService.queue || []).length
    };

    emitToRoom(io, 'gm-stations', 'video:status', payload);
    logger.info('Broadcasted video:loading to GM stations', { tokenId: data.tokenId });
  });

  addTrackedListener(videoQueueService, 'video:started', (data) => {
    const payload = {
      status: 'playing',
      tokenId: data.queueItem.tokenId,
      duration: data.duration,
      expectedEndTime: data.expectedEndTime,
      progress: 0,
      queueLength: (videoQueueService.queue || []).length
    };

    emitToRoom(io, 'gm-stations', 'video:status', payload);
    logger.info('Broadcasted video:started to GM stations', { tokenId: data.queueItem.tokenId });
  });

  addTrackedListener(videoQueueService, 'video:completed', (queueItem) => {
    const payload = {
      status: 'completed',
      tokenId: queueItem.tokenId,
      progress: 100,
      queueLength: (videoQueueService.queue || []).length
    };

    emitToRoom(io, 'gm-stations', 'video:status', payload);
    logger.info('Broadcasted video:completed to GM stations', { tokenId: queueItem.tokenId });
  });

  addTrackedListener(videoQueueService, 'video:failed', (queueItem) => {
    const payload = {
      status: 'error',
      tokenId: queueItem.tokenId,
      error: queueItem.error,
      queueLength: (videoQueueService.queue || []).length
    };

    emitToRoom(io, 'gm-stations', 'video:status', payload);
    logger.error('Broadcasted video:failed to GM stations', { tokenId: queueItem.tokenId, error: queueItem.error });
  });

  addTrackedListener(videoQueueService, 'video:paused', (queueItem) => {
    const payload = {
      status: 'paused',
      tokenId: queueItem?.tokenId || null,
      progress: queueItem?.progress || 0,
      queueLength: (videoQueueService.queue || []).length
    };

    emitToRoom(io, 'gm-stations', 'video:status', payload);
    logger.info('Broadcasted video:paused to GM stations', { tokenId: queueItem?.tokenId });
  });

  addTrackedListener(videoQueueService, 'video:idle', () => {
    const payload = {
      status: 'idle',
      tokenId: null,
      progress: 0,
      queueLength: (videoQueueService.queue || []).length
    };

    emitToRoom(io, 'gm-stations', 'video:status', payload);
    logger.info('Broadcasted video:idle to GM stations');
  });

  // Handle video resumed event
  addTrackedListener(videoQueueService, 'video:resumed', (queueItem) => {
    const payload = {
      status: 'playing', // Resume returns to playing state
      tokenId: queueItem?.tokenId || null,
      progress: queueItem?.progress || 0,
      queueLength: (videoQueueService.queue || []).length
    };

    emitToRoom(io, 'gm-stations', 'video:status', payload);
    logger.info('Broadcasted video:resumed as playing to GM stations');
  });

  // Handle video progress updates (emitted every 1s during playback)
  addTrackedListener(videoQueueService, 'video:progress', (data) => {
    const payload = {
      tokenId: data.queueItem?.tokenId || null,
      progress: data.progress || 0,
      position: Math.round((data.position || 0) * (data.duration || 0)), // Convert decimal to seconds
      duration: Math.round(data.duration || 0)
    };

    emitToRoom(io, 'gm-stations', 'video:progress', payload);
    // Don't log every progress update (too verbose)
  });

  // Broadcast queue updates to GM stations
  function broadcastQueueUpdate() {
    const queue = videoQueueService.getQueueItems();
    const pendingItems = queue
      .filter(item => item.isPending())
      .map(item => ({
        tokenId: item.tokenId,
        duration: item.duration || 0,
        requestedBy: item.requestedBy
      }));

    const payload = {
      items: pendingItems,
      length: pendingItems.length
    };

    emitToRoom(io, 'gm-stations', 'video:queue:update', payload);
    logger.debug('Broadcasted queue update to GM stations', { queueLength: pendingItems.length });
  }

  // Listen for queue changes and broadcast updates
  addTrackedListener(videoQueueService, 'queue:added', () => {
    broadcastQueueUpdate();
  });

  addTrackedListener(videoQueueService, 'queue:cleared', () => {
    broadcastQueueUpdate();
  });

  addTrackedListener(videoQueueService, 'video:completed', () => {
    broadcastQueueUpdate();
  });

  addTrackedListener(videoQueueService, 'video:started', () => {
    broadcastQueueUpdate(); // Update queue display with real duration from VLC
  });

  // Offline queue events
  if (offlineQueueService) {
    addTrackedListener(offlineQueueService, 'offline:queue:processed', (eventData) => {
      // Extract wrapped event data (service emits wrapped envelope per AsyncAPI)
      const { queueSize, results } = eventData.data || eventData;

      // Notify GM stations about queue processing results
      const payload = {
        queueSize,
        results
      };

      emitToRoom(io, 'gm-stations', 'offline:queue:processed', payload);
      logger.info('Broadcasted offline queue processing results', {
        queueSize: payload.queueSize,
        resultCount: payload.results?.length || 0
      });

      // Per AsyncAPI flow step 5: Broadcast sync:full after offline:queue:processed
      // Build sync:full directly from services (same pattern as handleSyncRequest)
      const session = sessionService.getCurrentSession();

      const videoStatus = {
        status: videoQueueService.currentStatus || 'idle',
        queueLength: (videoQueueService.queue || []).length,
        tokenId: videoQueueService.currentVideo?.tokenId || null,
        duration: videoQueueService.currentVideo?.duration || null,
        progress: videoQueueService.currentVideo?.progress || null,
        expectedEndTime: videoQueueService.currentVideo?.expectedEndTime || null,
        error: videoQueueService.currentVideo?.error || null
      };

      const scores = [];
      for (const [, teamScore] of transactionService.teamScores) {
        scores.push(teamScore.toJSON());
      }

      const recentTransactions = [];
      if (session && session.transactions) {
        const limit = 10;
        const start = Math.max(0, session.transactions.length - limit);
        for (let i = start; i < session.transactions.length; i++) {
          const transaction = session.transactions[i];
          // Enrich with token data (same as transaction:new broadcast)
          const token = transactionService.getToken(transaction.tokenId);
          recentTransactions.push({
            id: transaction.id,
            tokenId: transaction.tokenId,
            teamId: transaction.teamId,
            deviceId: transaction.deviceId,
            mode: transaction.mode,
            status: transaction.status,
            points: transaction.points,
            timestamp: transaction.timestamp,
            memoryType: token?.memoryType || 'UNKNOWN',
            valueRating: token?.metadata?.rating || 0
          });
        }
      }

      // Get VLC connection status
      const vlcConnected = vlcService?.isConnected ? vlcService.isConnected() : false;

      const syncFullPayload = {
        session: session ? session.toJSON() : null,
        scores,
        recentTransactions,
        videoStatus,
        devices: session ? (session.connectedDevices || []).map(device => ({
          deviceId: device.id,
          type: device.type,
          name: device.name,
          connectionTime: device.connectionTime,
          ipAddress: device.ipAddress
        })) : [],
        systemStatus: {
          // Contract-compliant fields
          orchestrator: 'online',  // Per AsyncAPI contract: 'online' | 'offline'
          vlc: vlcConnected ? 'connected' : 'disconnected',  // Per AsyncAPI contract: 'connected' | 'disconnected' | 'error'
          // Additional fields not in contract but used by implementation
          videoDisplayReady: false,  // TODO: Track actual display ready status
          offline: offlineQueueService?.isOffline || false
        }
      };

      emitWrapped(io, 'sync:full', syncFullPayload);
      logger.info('Broadcasted sync:full after offline queue processing');
    });
  }

  // Error events
  const handleServiceError = (service, error) => {
    emitWrapped(io, 'error', {
      service,
      message: error.message,
      code: error.code || 'INTERNAL_ERROR',
    });
    logger.error(`Service error broadcasted`, { service, error: error.message });
  };

  addTrackedListener(sessionService, 'error', (error) => handleServiceError('session', error));
  addTrackedListener(stateService, 'error', (error) => handleServiceError('state', error));
  addTrackedListener(videoQueueService, 'error', (error) => handleServiceError('video', error));
  if (offlineQueueService) {
    addTrackedListener(offlineQueueService, 'error', (error) => handleServiceError('offline', error));
  }

  logger.info('Broadcast listeners initialized');
}

/**
 * Initialize all currently connected devices into newly created session
 * Called when session is created to add devices that connected before session existed
 *
 * This implements the event-driven pattern:
 * - Service emits 'session:created' domain event
 * - Broadcast layer handles WebSocket-specific concerns (room joining, device registration)
 * - Maintains separation of concerns (sessionService stays pure)
 *
 * @param {Server} io - Socket.io server instance
 * @param {Session} session - Newly created session
 */
function initializeSessionDevices(io, session) {
  const sessionService = require('../services/sessionService');
  const sockets = Array.from(io.sockets.sockets.values());
  let devicesAdded = 0;

  for (const socket of sockets) {
    if (socket.isAuthenticated && socket.deviceId) {
      // Create device data from socket information
      const deviceData = {
        id: socket.deviceId,
        type: socket.deviceType || 'gm',
        name: `${socket.deviceType === 'gm' ? 'GM Station' : 'Admin'} v${socket.version || '1.0.0'}`,
        ipAddress: socket.handshake.address,
        connectionTime: new Date().toISOString(),
        lastHeartbeat: new Date().toISOString(),
        connectionStatus: 'connected'
      };

      // Add to session.connectedDevices (updates existing or creates new)
      sessionService.updateDevice(deviceData);

      // Join Socket.IO room for session-specific broadcasts (transaction:new, etc)
      socket.join(`session:${session.id}`);

      devicesAdded++;
    }
  }

  logger.info('Initialized session devices', {
    sessionId: session.id,
    devicesAdded,
    totalConnected: sockets.length
  });
}

/**
 * Clean up all broadcast listeners
 * CRITICAL: Call this between tests to prevent listener accumulation
 */
function cleanupBroadcastListeners() {
  logger.info('Starting broadcast listener cleanup', {
    activeCount: activeListeners.length
  });

  // Remove ALL tracked listeners
  activeListeners.forEach(({ service, event, handler }) => {
    try {
      service.removeListener(event, handler);
    } catch (error) {
      logger.warn('Failed to remove listener', {
        service: service.constructor.name,
        event,
        error: error.message
      });
    }
  });

  // Clear the array
  activeListeners.length = 0;

  // Also cleanup registry
  listenerRegistry.cleanup();

  logger.info('Broadcast listener cleanup completed');
}

module.exports = {
  setupBroadcastListeners,
  cleanupBroadcastListeners,
};