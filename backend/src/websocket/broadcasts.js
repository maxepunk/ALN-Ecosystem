/**
 * WebSocket Broadcast Handler
 * Manages event broadcasting to connected clients
 */

const logger = require('../utils/logger');
const listenerRegistry = require('./listenerRegistry');
const { emitWrapped, emitToRoom } = require('./eventWrapper');
const { buildSyncFullPayload, buildHeldItemsState } = require('./syncHelpers');
const serviceHealthRegistry = require('../services/serviceHealthRegistry');

// Module-level listener tracking for cleanup
const activeListeners = [];

// Idempotency guard flag
let broadcastListenersActive = false;

// Stash teamScore from transaction:accepted for enriching transaction:new
const teamScoreStash = new Map();

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
    bluetoothService, audioRoutingService, lightingService, gameClockService, cueEngineService, soundService,
    spotifyService, vlcService, displayControlService } = services;


  // Session events - session:update replaces session:new/paused/resumed/ended
  // Per AsyncAPI contract and Decision #7 (send FULL resource, not deltas)
  addTrackedListener(sessionService, 'session:created', async (session) => {
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

    // Initialize all currently connected devices into the new session
    // This handles devices that connected before session existed
    // AWAIT to ensure all devices are registered before continuing
    await initializeSessionDevices(io, session);

    // Broadcast sync:full so all GMs get complete state (including device list)
    // Without this, GMs that connected before session creation would not see
    // themselves in the device list until the next manual sync:request
    try {
      const syncPayload = await buildSyncFullPayload({
        sessionService, transactionService, videoQueueService,
        bluetoothService, audioRoutingService, lightingService,
        gameClockService, cueEngineService, spotifyService,
      });
      emitToRoom(io, 'gm', 'sync:full', syncPayload);
      logger.info('Broadcasted sync:full after session creation', { sessionId: session.id });
    } catch (err) {
      logger.warn('Failed to broadcast sync:full after session creation', {
        sessionId: session.id, error: err.message,
      });
    }

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

    // Retrieve stashed teamScore (from transaction:accepted that fires first)
    const stashedTeamScore = teamScoreStash.get(transaction.id);
    teamScoreStash.delete(transaction.id);

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
        isUnknown: !token,  // Frontend needs this to avoid marking valid tokens as unknown
        owner: token?.metadata?.owner || null
      },
      teamScore: stashedTeamScore || null
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

  // Transaction/Score events - broadcast to GM stations only
  if (transactionService) {
    // Score stash for transaction:new enrichment
    addTrackedListener(transactionService, 'transaction:accepted', (payload) => {
      // Stash teamScore for enriching the upcoming transaction:new broadcast
      if (payload.transaction?.id && payload.teamScore) {
        teamScoreStash.set(payload.transaction.id, payload.teamScore);
      }
    });

    // Admin score adjustments — broadcast to session room
    addTrackedListener(transactionService, 'score:adjusted', (payload) => {
      const session = sessionService.getCurrentSession();
      if (session && payload.teamScore) {
        emitToRoom(io, `session:${session.id}`, 'score:adjusted', {
          teamScore: payload.teamScore
        });
      }
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

    // Transaction service - scores reset (bulk operation)
    addTrackedListener(transactionService, 'scores:reset', async (data) => {
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

      // Build proper sync:full payload (not GameState — that lacks `session` field)
      const syncFullPayload = await buildSyncFullPayload({
        sessionService,
        transactionService,
        videoQueueService,
        bluetoothService,
        audioRoutingService,
        lightingService,
        gameClockService,
        cueEngineService,
        spotifyService,
        deviceFilter: { connectedOnly: true },
      });
      emitToRoom(io, 'gm', 'sync:full', syncFullPayload);

      logger.info('Broadcasted scores:reset + sync:full to session', {
        sessionId: session.id,
        teamsReset: data?.teamsReset?.length || 0
      });
    });
  }

  // Offline queue events
  if (offlineQueueService) {
    addTrackedListener(offlineQueueService, 'offline:queue:processed', async (eventData) => {
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
      const syncFullPayload = await buildSyncFullPayload({
        sessionService,
        transactionService,
        videoQueueService,
        bluetoothService,
        audioRoutingService,
        lightingService,
        gameClockService,
        cueEngineService,
        spotifyService,
        deviceFilter: { connectedOnly: true },
      });

      emitToRoom(io, 'gm', 'sync:full', syncFullPayload);
      logger.info('Broadcasted sync:full after offline queue processing');
    });
  }

  // ============================================================
  // INTER-SERVICE COORDINATION (not broadcasts — service-to-service)
  // ============================================================

  // Ducking engine wiring: forward video/sound lifecycle events to audioRoutingService
  if (audioRoutingService && videoQueueService) {
    addTrackedListener(videoQueueService, 'video:started', () => {
      audioRoutingService.handleDuckingEvent('video', 'started');
      // Route video audio to configured output (VLC sink-input exists by video:started)
      audioRoutingService.applyRouting('video').catch(err => {
        logger.warn('Video audio routing failed on video:started', { error: err.message });
      });
    });
    addTrackedListener(videoQueueService, 'video:completed', () => {
      audioRoutingService.handleDuckingEvent('video', 'completed');
    });
    addTrackedListener(videoQueueService, 'video:paused', () => {
      audioRoutingService.handleDuckingEvent('video', 'paused');
    });
    addTrackedListener(videoQueueService, 'video:resumed', () => {
      audioRoutingService.handleDuckingEvent('video', 'resumed');
    });
  }

  if (audioRoutingService && soundService) {
    addTrackedListener(soundService, 'sound:started', () => {
      audioRoutingService.handleDuckingEvent('sound', 'started');
    });
    addTrackedListener(soundService, 'sound:completed', () => {
      audioRoutingService.handleDuckingEvent('sound', 'completed');
    });
  }

  // ============================================================
  // DISCRETE GAME EVENTS (NOT service state — these are action events)
  // ============================================================

  // Cue Engine events
  if (cueEngineService) {
    addTrackedListener(cueEngineService, 'cue:fired', (data) => {
      emitToRoom(io, 'gm', 'cue:fired', data);
      logger.debug('Broadcasted cue:fired', { cueId: data.cueId });
    });
    addTrackedListener(cueEngineService, 'cue:completed', (data) => {
      emitToRoom(io, 'gm', 'cue:completed', data);
      logger.debug('Broadcasted cue:completed', { cueId: data.cueId });
    });
    addTrackedListener(cueEngineService, 'cue:error', (data) => {
      emitToRoom(io, 'gm', 'cue:error', data);
      logger.error('Broadcasted cue:error', { cueId: data.cueId, error: data.error });
    });
  }

  // Display mode events
  if (displayControlService) {
    addTrackedListener(displayControlService, 'display:mode:changed', (data) => {
      emitWrapped(io, 'display:mode', data);
      logger.debug('Broadcasted display:mode', { mode: data.mode });
    });
  }

  // ============================================================
  // UNIFIED service:state BROADCASTS (sole push mechanism for service domains)
  // ============================================================

  /**
   * Push unified service:state event with full state snapshot.
   * This is the sole broadcast mechanism for service domain state.
   * Frontend StateStore consumes these events via store subscriptions.
   */
  function pushServiceState(domain, service) {
    emitToRoom(io, 'gm', 'service:state', { domain, state: service.getState() });
  }

  // Spotify → service:state { domain: 'spotify' }
  if (spotifyService) {
    for (const event of ['playback:changed', 'volume:changed', 'track:changed']) {
      addTrackedListener(spotifyService, event, () => pushServiceState('spotify', spotifyService));
    }
  }

  // Video — VLC state changes AND video lifecycle events both push video domain
  if (vlcService) {
    addTrackedListener(vlcService, 'state:changed', () => pushServiceState('video', videoQueueService));
  }
  const VIDEO_LIFECYCLE_EVENTS = [
    'video:started', 'video:completed', 'video:paused', 'video:resumed',
    'video:loading', 'video:idle', 'video:failed',
  ];
  for (const event of VIDEO_LIFECYCLE_EVENTS) {
    addTrackedListener(videoQueueService, event, () => pushServiceState('video', videoQueueService));
  }
  const QUEUE_EVENTS = ['queue:added', 'queue:cleared', 'queue:reordered', 'queue:pending-cleared', 'queue:reset'];
  for (const event of QUEUE_EVENTS) {
    addTrackedListener(videoQueueService, event, () => pushServiceState('video', videoQueueService));
  }

  // Health → service:state { domain: 'health' }
  addTrackedListener(serviceHealthRegistry, 'health:changed', () => {
    pushServiceState('health', serviceHealthRegistry);
  });

  // Bluetooth → service:state { domain: 'bluetooth' }
  if (bluetoothService) {
    for (const event of ['device:connected', 'device:disconnected', 'device:paired', 'device:unpaired', 'device:discovered', 'scan:started', 'scan:stopped']) {
      addTrackedListener(bluetoothService, event, () => pushServiceState('bluetooth', bluetoothService));
    }
  }

  // Audio → service:state { domain: 'audio' }
  if (audioRoutingService) {
    for (const event of ['routing:changed', 'routing:applied', 'routing:fallback', 'sink:added', 'sink:removed', 'ducking:changed', 'combine-sink:created', 'combine-sink:destroyed']) {
      addTrackedListener(audioRoutingService, event, () => pushServiceState('audio', audioRoutingService));
    }
  }

  // Lighting → service:state { domain: 'lighting' }
  if (lightingService) {
    for (const event of ['scene:activated', 'scenes:refreshed']) {
      addTrackedListener(lightingService, event, () => pushServiceState('lighting', lightingService));
    }
  }

  // Sound → service:state { domain: 'sound' }
  if (soundService) {
    for (const event of ['sound:started', 'sound:completed', 'sound:stopped', 'sound:error']) {
      addTrackedListener(soundService, event, () => pushServiceState('sound', soundService));
    }
  }

  // Game Clock → service:state { domain: 'gameclock' }
  if (gameClockService) {
    for (const event of ['gameclock:started', 'gameclock:paused', 'gameclock:resumed']) {
      addTrackedListener(gameClockService, event, () => pushServiceState('gameclock', gameClockService));
    }
  }

  // Cue Engine → service:state { domain: 'cueengine' }
  // NOTE: cue:fired/cue:completed also emit as discrete game events above.
  // They're included here because they change cueEngine.getState() (activeCues list).
  if (cueEngineService) {
    for (const event of ['cue:fired', 'cue:completed', 'cue:started', 'cue:status']) {
      addTrackedListener(cueEngineService, event, () => pushServiceState('cueengine', cueEngineService));
    }
  }

  // Held Items → service:state { domain: 'held' }
  // Aggregates held cues + held videos from both services
  function pushHeldState() {
    const items = buildHeldItemsState(cueEngineService, videoQueueService);
    emitToRoom(io, 'gm', 'service:state', { domain: 'held', state: { items } });
  }
  if (cueEngineService) {
    for (const event of ['cue:held', 'cue:released', 'cue:discarded']) {
      addTrackedListener(cueEngineService, event, pushHeldState);
    }
  }
  for (const event of ['video:held', 'video:released', 'video:discarded', 'video:recoverable']) {
    addTrackedListener(videoQueueService, event, pushHeldState);
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

  // Clear teamScore stash to prevent state leaking between resets
  teamScoreStash.clear();

  // Reset flag to allow re-setup
  broadcastListenersActive = false;

  logger.info('Broadcast listener cleanup completed');
}

module.exports = {
  setupBroadcastListeners,
  cleanupBroadcastListeners,
};