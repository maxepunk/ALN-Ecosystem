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

// Idempotency guard flag
let broadcastListenersActive = false;

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
  // Idempotency check - prevent duplicate listener registration
  if (broadcastListenersActive) {
    logger.debug('Broadcast listeners already active, skipping duplicate setup', {
      activeListeners: activeListeners.length
    });
    return;
  }

  logger.info('Setting up broadcast listeners');
  broadcastListenersActive = true;

  const { sessionService, stateService, videoQueueService, offlineQueueService, transactionService,
    bluetoothService, audioRoutingService, lightingService } = services;

  // Session events - session:update replaces session:new/paused/resumed/ended
  // Per AsyncAPI contract and Decision #7 (send FULL resource, not deltas)
  addTrackedListener(sessionService, 'session:created', async (session) => {
    // DIAGNOSTIC 1: Confirm listener is triggered
    logger.info('[DIAG-1] session:created listener TRIGGERED', {
      sessionId: session.id,
      timestamp: new Date().toISOString()
    });

    // DIAGNOSTIC 2: Verify io object state BEFORE emitWrapped
    logger.info('[DIAG-2] io object state', {
      ioExists: !!io,
      ioType: io?.constructor?.name,
      engineExists: !!io?.engine,
      socketsMapSize: io?.sockets?.sockets?.size || 'N/A'
    });

    // Broadcast session update to all clients
    emitWrapped(io, 'session:update', {
      id: session.id,              // Decision #4: 'id' field within resource
      name: session.name,
      startTime: session.startTime,
      endTime: session.endTime,
      status: session.status,      // 'active' for new session
      teams: session.teams,  // session:created receives plain object with teams already computed
      metadata: session.metadata || {}
    });

    // DIAGNOSTIC 3: emitWrapped completed (sync portion)
    logger.info('[DIAG-3] emitWrapped completed synchronously');

    // Initialize all currently connected devices into the new session
    // This handles devices that connected before session existed
    // AWAIT to ensure all devices are registered before continuing
    await initializeSessionDevices(io, session);

    logger.info('Broadcasted session:update (created)', { sessionId: session.id, status: session.status });
  });

  addTrackedListener(sessionService, 'session:updated', (session) => {
    // Handle both Session objects (with toJSON) and plain objects (from endSession)
    const teams = typeof session.toJSON === 'function'
      ? session.toJSON().teams
      : (session.teams || []);

    emitWrapped(io, 'session:update', {
      id: session.id,              // Decision #4: 'id' field within resource
      name: session.name,
      startTime: session.startTime,
      endTime: session.endTime,
      status: session.status,      // 'paused', 'active', or 'ended'
      teams,
      metadata: session.metadata || {}
    });
    logger.info('Broadcasted session:update', { sessionId: session.id, status: session.status });
  });

  // Session overtime warning (does NOT end session, only notifies GMs)
  addTrackedListener(sessionService, 'session:overtime', (data) => {
    const now = new Date();
    const startTime = new Date(data.startTime);
    const actualDuration = Math.floor((now - startTime) / 1000 / 60); // minutes

    const payload = {
      sessionId: data.sessionId,
      sessionName: data.sessionName,
      startTime: data.startTime,
      expectedDuration: data.expectedDuration, // minutes
      actualDuration: actualDuration,
      overtimeDuration: actualDuration - data.expectedDuration,
      timestamp: now.toISOString()
    };

    // Broadcast warning to GM stations only
    emitToRoom(io, 'gm', 'session:overtime', payload);
    logger.warn('Broadcasted session:overtime warning to GM stations', {
      sessionId: data.sessionId,
      overtimeDuration: payload.overtimeDuration
    });
  });

  // Device events - broadcast device connections (centralized)
  // Handles BOTH WebSocket (GM) and HTTP (Player) device registrations
  // Replaces manual broadcast from gmAuth.js for consistency
  addTrackedListener(sessionService, 'device:updated', ({ device, isNew, isReconnection }) => {
    // Broadcast device:connected for:
    // 1. NEW devices that are CONNECTED (first connection)
    // 2. Existing devices that RECONNECTED (status changed from disconnected to connected)
    // Skip: heartbeat updates, disconnect status changes
    if ((isNew || isReconnection) && device.connectionStatus === 'connected') {
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
        source: 'centralized',
        isReconnection: isReconnection || false
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
        valueRating: token?.metadata?.rating || 0,
        group: token?.metadata?.group || token?.groupId || 'No Group',
        summary: transaction.summary || null,  // Summary from transaction (complete persisted record)
        isUnknown: !token  // Frontend needs this to avoid marking valid tokens as unknown
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
    const gmRoom = io.sockets.adapter.rooms.get('gm');
    const gmCount = gmRoom ? gmRoom.size : 0;

    emitToRoom(io, 'gm', 'state:update', delta);

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
    // DRY helper: broadcast score:updated from any source
    function broadcastScoreUpdate(teamScore, source) {
      if (!teamScore) return;

      const scorePayload = {
        teamId: teamScore.teamId,
        currentScore: teamScore.currentScore,
        baseScore: teamScore.baseScore,
        bonusPoints: teamScore.bonusPoints || 0,
        tokensScanned: teamScore.tokensScanned,
        completedGroups: teamScore.completedGroups || [],
        adminAdjustments: teamScore.adminAdjustments || [],
        lastUpdate: teamScore.lastUpdate
      };

      emitToRoom(io, 'gm', 'score:updated', scorePayload);
      logger.info(`Broadcasted score:updated from ${source}`, {
        teamId: teamScore.teamId,
        score: teamScore.currentScore
      });
    }

    // Score updates from new transactions
    addTrackedListener(transactionService, 'transaction:accepted', (payload) => {
      broadcastScoreUpdate(payload.teamScore, 'transaction:accepted');
    });

    // Score updates from admin adjustments
    addTrackedListener(transactionService, 'score:adjusted', (payload) => {
      broadcastScoreUpdate(payload.teamScore, 'score:adjusted');
    });

    addTrackedListener(transactionService, 'transaction:deleted', (data) => {
      const payload = {
        transactionId: data.transactionId,
        teamId: data.teamId,
        tokenId: data.tokenId
      };

      // CRITICAL: Use session-scoped broadcast like transaction:new
      // This prevents cross-session event contamination in tests and production
      const session = sessionService.getCurrentSession();
      if (session) {
        emitToRoom(io, `session:${session.id}`, 'transaction:deleted', payload);
        logger.info('Broadcasted transaction:deleted to session', {
          transactionId: data.transactionId,
          teamId: data.teamId,
          tokenId: data.tokenId,
          sessionId: session.id
        });
      } else {
        // Fallback: if no session, broadcast globally (shouldn't happen in normal flow)
        emitToRoom(io, 'gm', 'transaction:deleted', payload);
        logger.warn('Broadcasted transaction:deleted globally - no session found', {
          transactionId: data.transactionId,
          teamId: data.teamId
        });
      }

      // Broadcast updated score (for black market mode scoreboard)
      broadcastScoreUpdate(data.updatedTeamScore, 'transaction:deleted');
    });

    addTrackedListener(transactionService, 'group:completed', (data) => {
      const payload = {
        teamId: data.teamId,
        group: data.groupId,           // AsyncAPI: 'group' not 'groupId'
        bonusPoints: data.bonus,        // AsyncAPI: 'bonusPoints' not 'bonus'
        completedAt: new Date().toISOString()  // AsyncAPI: required timestamp
      };

      emitToRoom(io, 'gm', 'group:completed', payload);
      logger.info('Broadcasted group:completed to GM stations', data);
    });

    // Note: team:created listener removed - teams now created via sessionService.addTeamToSession()
    // which emits session:updated (already handled above)

    // Transaction service - scores reset (bulk operation)
    addTrackedListener(transactionService, 'scores:reset', (data) => {
      // Get session FIRST for scoped broadcast
      const session = sessionService.getCurrentSession();
      if (!session) {
        logger.warn('No active session during scores:reset');
        return;
      }

      // CRITICAL: Use session-scoped broadcast like transaction:deleted
      // This prevents cross-session event contamination in tests and production
      emitToRoom(io, `session:${session.id}`, 'scores:reset', {
        teamsReset: data?.teamsReset || []
      });

      // Provide complete updated state (follows processQueue pattern)
      const fullState = stateService.getCurrentState();
      emitWrapped(io, 'sync:full', fullState);

      logger.info('Broadcasted scores:reset + sync:full to session', {
        sessionId: session.id,
        teamsReset: data?.teamsReset?.length || 0
      });
    });
  }

  // Video events (contract-compliant)
  addTrackedListener(videoQueueService, 'video:loading', (data) => {
    const payload = {
      status: 'loading',
      tokenId: data.tokenId,
      queueLength: (videoQueueService.queue || []).length
    };

    emitToRoom(io, 'gm', 'video:status', payload);
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

    emitToRoom(io, 'gm', 'video:status', payload);
    logger.info('Broadcasted video:started to GM stations', { tokenId: data.queueItem.tokenId });
  });

  addTrackedListener(videoQueueService, 'video:completed', (queueItem) => {
    const payload = {
      status: 'completed',
      tokenId: queueItem.tokenId,
      progress: 100,
      queueLength: (videoQueueService.queue || []).length
    };

    emitToRoom(io, 'gm', 'video:status', payload);
    logger.info('Broadcasted video:completed to GM stations', { tokenId: queueItem.tokenId });

    // Also update queue display (queue length changes after video completes)
    broadcastQueueUpdate();
  });

  addTrackedListener(videoQueueService, 'video:failed', (queueItem) => {
    const payload = {
      status: 'error',
      tokenId: queueItem.tokenId,
      error: queueItem.error,
      queueLength: (videoQueueService.queue || []).length
    };

    emitToRoom(io, 'gm', 'video:status', payload);
    logger.error('Broadcasted video:failed to GM stations', { tokenId: queueItem.tokenId, error: queueItem.error });
  });

  addTrackedListener(videoQueueService, 'video:paused', (queueItem) => {
    const payload = {
      status: 'paused',
      tokenId: queueItem?.tokenId || null,
      progress: queueItem?.progress || 0,
      queueLength: (videoQueueService.queue || []).length
    };

    emitToRoom(io, 'gm', 'video:status', payload);
    logger.info('Broadcasted video:paused to GM stations', { tokenId: queueItem?.tokenId });
  });

  addTrackedListener(videoQueueService, 'video:idle', () => {
    const payload = {
      status: 'idle',
      tokenId: null,
      progress: 0,
      queueLength: (videoQueueService.queue || []).length
    };

    emitToRoom(io, 'gm', 'video:status', payload);
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

    emitToRoom(io, 'gm', 'video:status', payload);
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

    emitToRoom(io, 'gm', 'video:progress', payload);
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

    emitToRoom(io, 'gm', 'video:queue:update', payload);
    logger.debug('Broadcasted queue update to GM stations', { queueLength: pendingItems.length });
  }

  // Listen for queue changes and broadcast updates
  addTrackedListener(videoQueueService, 'queue:added', () => {
    broadcastQueueUpdate();
  });

  addTrackedListener(videoQueueService, 'queue:cleared', () => {
    broadcastQueueUpdate();
  });

  // NOTE: video:completed queue update moved to main video:completed handler at line 341
  // to avoid duplicate listener registration (causes listener accumulation in tests)

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

      emitToRoom(io, 'gm', 'offline:queue:processed', payload);
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

      // Enrich ALL transactions with token data (for full state restoration)
      // CRITICAL: Send ALL transactions, not just recent 10, to support team details screen
      // after page refresh. Frontend DataManager needs complete transaction history.
      const recentTransactions = [];
      if (session && session.transactions) {
        for (let i = 0; i < session.transactions.length; i++) {
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
            valueRating: token?.metadata?.rating || 0,
            summary: transaction.summary || null  // Transaction already enriched at creation (source of truth)
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
        },
        // Game Activity: Include player scans for token lifecycle tracking
        playerScans: session?.playerScans || []
      };

      emitWrapped(io, 'sync:full', syncFullPayload);
      logger.info('Broadcasted sync:full after offline queue processing');
    });
  }

  // ============================================================
  // ENVIRONMENT CONTROL BROADCASTS (Phase 0)
  // ============================================================

  // Bluetooth events
  if (bluetoothService) {
    addTrackedListener(bluetoothService, 'device:connected', (device) => {
      emitToRoom(io, 'gm', 'bluetooth:device', { type: 'connected', device });
      logger.debug('Broadcasted bluetooth:device connected', { address: device?.address });
    });
    addTrackedListener(bluetoothService, 'device:disconnected', (device) => {
      emitToRoom(io, 'gm', 'bluetooth:device', { type: 'disconnected', device });
      logger.debug('Broadcasted bluetooth:device disconnected', { address: device?.address });
    });
    addTrackedListener(bluetoothService, 'device:paired', (device) => {
      emitToRoom(io, 'gm', 'bluetooth:device', { type: 'paired', device });
      logger.debug('Broadcasted bluetooth:device paired', { address: device?.address });
    });
    addTrackedListener(bluetoothService, 'device:unpaired', (device) => {
      emitToRoom(io, 'gm', 'bluetooth:device', { type: 'unpaired', device });
      logger.debug('Broadcasted bluetooth:device unpaired', { address: device?.address });
    });
    addTrackedListener(bluetoothService, 'device:discovered', (device) => {
      emitToRoom(io, 'gm', 'bluetooth:device', { type: 'discovered', device });
    });
    addTrackedListener(bluetoothService, 'scan:started', (data) => {
      emitToRoom(io, 'gm', 'bluetooth:scan', { scanning: true, ...data });
      logger.debug('Broadcasted bluetooth:scan started');
    });
    addTrackedListener(bluetoothService, 'scan:stopped', (data) => {
      emitToRoom(io, 'gm', 'bluetooth:scan', { scanning: false, ...data });
      logger.debug('Broadcasted bluetooth:scan stopped');
    });
  }

  // Audio routing events
  if (audioRoutingService) {
    addTrackedListener(audioRoutingService, 'routing:changed', (data) => {
      emitToRoom(io, 'gm', 'audio:routing', data);
      logger.debug('Broadcasted audio:routing changed', { stream: data?.stream, sink: data?.sink });
    });
    addTrackedListener(audioRoutingService, 'routing:applied', (data) => {
      emitToRoom(io, 'gm', 'audio:routing', data);
      logger.debug('Broadcasted audio:routing applied', { stream: data?.stream, sink: data?.sink });
    });
    addTrackedListener(audioRoutingService, 'routing:fallback', (data) => {
      emitToRoom(io, 'gm', 'audio:routing:fallback', data);
      logger.info('Broadcasted audio:routing:fallback', { stream: data?.stream, actualSink: data?.actualSink });
    });
  }

  // Lighting events
  if (lightingService) {
    addTrackedListener(lightingService, 'scene:activated', (data) => {
      emitToRoom(io, 'gm', 'lighting:scene', data);
      logger.debug('Broadcasted lighting:scene activated', { sceneId: data?.sceneId });
    });
    addTrackedListener(lightingService, 'connection:changed', (data) => {
      emitToRoom(io, 'gm', 'lighting:status', data);
      logger.debug('Broadcasted lighting:status', { connected: data?.connected });
    });
    addTrackedListener(lightingService, 'scenes:refreshed', (data) => {
      emitToRoom(io, 'gm', 'lighting:status', { type: 'refreshed', ...data });
      logger.debug('Broadcasted lighting:status refreshed', { sceneCount: data?.scenes?.length });
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
async function initializeSessionDevices(io, session) {
  const sessionService = require('../services/sessionService');
  const sockets = Array.from(io.sockets.sockets.values());
  let devicesAdded = 0;

  // CRITICAL FIX: Process devices sequentially to prevent race conditions
  // where device:connected broadcasts fire before all devices are added
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
      // AWAIT to ensure device is fully added before processing next device
      // This prevents race condition where broadcasts fire with incomplete device list
      await sessionService.updateDevice(deviceData);

      // CRITICAL: Leave old session room before joining new one
      // This prevents cross-session event contamination in tests and production
      const currentRooms = Array.from(socket.rooms);
      const oldSessionRoom = currentRooms.find(room => room.startsWith('session:'));
      if (oldSessionRoom && oldSessionRoom !== `session:${session.id}`) {
        socket.leave(oldSessionRoom);
        logger.debug('Socket left old session room', {
          deviceId: socket.deviceId,
          oldRoom: oldSessionRoom,
          newRoom: `session:${session.id}`
        });
      }

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
  if (!broadcastListenersActive) {
    logger.debug('Broadcast listeners not active, nothing to cleanup');
    return;
  }

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

  // Reset flag to allow re-setup
  broadcastListenersActive = false;

  logger.info('Broadcast listener cleanup completed');
}

module.exports = {
  setupBroadcastListeners,
  cleanupBroadcastListeners,
};