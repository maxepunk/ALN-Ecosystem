/**
 * Video Events WebSocket Handler
 * Manages video playback events over WebSocket
 */

const logger = require('../utils/logger');
const videoQueueService = require('../services/videoQueueService');
const vlcService = require('../services/vlcService');
const sessionService = require('../services/sessionService');

/**
 * Handle video play command
 * @param {Socket} socket - Socket.io socket instance
 * @param {Object} data - Command data { tokenId, gmStation }
 * @param {Server} io - Socket.io server instance
 */
async function handleVideoPlay(socket, data, io) {
  try {
    if (!socket.isGm) {
      socket.emit('error', {
        code: 'PERMISSION_DENIED',
        message: 'Only GM stations can play videos'
      });
      return;
    }

    const { tokenId, gmStation } = data;
    
    // Add to queue
    const queueItem = await videoQueueService.addToQueue({
      tokenId,
      requestedBy: gmStation || socket.deviceId,
      priority: data.priority || 1
    });

    // Broadcast to all clients
    io.emit('video:queued', {
      tokenId,
      position: queueItem.position,
      requestedBy: gmStation,
      timestamp: new Date().toISOString()
    });

    logger.info('Video queued', { tokenId, gmStation, socketId: socket.id });
  } catch (error) {
    logger.error('Failed to queue video', { error, data });
    socket.emit('error', {
      code: 'VIDEO_ERROR',
      message: error.message
    });
  }
}

/**
 * Handle video pause command
 * @param {Socket} socket - Socket.io socket instance
 * @param {Server} io - Socket.io server instance
 */
async function handleVideoPause(socket, io) {
  try {
    if (!socket.isGm) {
      socket.emit('error', {
        code: 'PERMISSION_DENIED',
        message: 'Only GM stations can pause videos'
      });
      return;
    }

    await vlcService.pause();
    
    io.emit('video:status', {
      status: 'paused',
      timestamp: new Date().toISOString()
    });

    logger.info('Video paused', { socketId: socket.id });
  } catch (error) {
    logger.error('Failed to pause video', { error });
    socket.emit('error', {
      code: 'VIDEO_ERROR',
      message: error.message
    });
  }
}

/**
 * Handle video resume command
 * @param {Socket} socket - Socket.io socket instance
 * @param {Server} io - Socket.io server instance
 */
async function handleVideoResume(socket, io) {
  try {
    if (!socket.isGm) {
      socket.emit('error', {
        code: 'PERMISSION_DENIED',
        message: 'Only GM stations can resume videos'
      });
      return;
    }

    await vlcService.resume();
    
    io.emit('video:status', {
      status: 'playing',
      timestamp: new Date().toISOString()
    });

    logger.info('Video resumed', { socketId: socket.id });
  } catch (error) {
    logger.error('Failed to resume video', { error });
    socket.emit('error', {
      code: 'VIDEO_ERROR',
      message: error.message
    });
  }
}

/**
 * Handle video skip command
 * @param {Socket} socket - Socket.io socket instance
 * @param {Server} io - Socket.io server instance
 */
async function handleVideoSkip(socket, io) {
  try {
    if (!socket.isGm) {
      socket.emit('error', {
        code: 'PERMISSION_DENIED',
        message: 'Only GM stations can skip videos'
      });
      return;
    }

    // Skip current video
    await vlcService.stop();
    
    // Process next in queue
    const next = await videoQueueService.processQueue();
    
    if (next) {
      io.emit('video:status', {
        status: 'playing',
        tokenId: next.tokenId,
        timestamp: new Date().toISOString()
      });
    } else {
      io.emit('video:status', {
        status: 'idle',
        timestamp: new Date().toISOString()
      });
    }

    logger.info('Video skipped', { socketId: socket.id });
  } catch (error) {
    logger.error('Failed to skip video', { error });
    socket.emit('error', {
      code: 'VIDEO_ERROR',
      message: error.message
    });
  }
}

/**
 * Handle video stop command
 * @param {Socket} socket - Socket.io socket instance
 * @param {Server} io - Socket.io server instance
 */
async function handleVideoStop(socket, io) {
  try {
    if (!socket.isGm) {
      socket.emit('error', {
        code: 'PERMISSION_DENIED',
        message: 'Only GM stations can stop videos'
      });
      return;
    }

    await vlcService.stop();
    await videoQueueService.clearQueue();
    
    io.emit('video:status', {
      status: 'stopped',
      timestamp: new Date().toISOString()
    });

    logger.info('Video stopped and queue cleared', { socketId: socket.id });
  } catch (error) {
    logger.error('Failed to stop video', { error });
    socket.emit('error', {
      code: 'VIDEO_ERROR',
      message: error.message
    });
  }
}

/**
 * Handle get video status request
 * @param {Socket} socket - Socket.io socket instance
 */
async function handleVideoStatusRequest(socket) {
  try {
    const vlcStatus = await vlcService.getStatus();
    const queue = await videoQueueService.getQueue();
    const currentItem = queue.find(item => item.status === 'playing');
    
    socket.emit('video:status', {
      vlc: vlcStatus,
      current: currentItem || null,
      queueLength: queue.length,
      timestamp: new Date().toISOString()
    });

    logger.debug('Video status sent', { socketId: socket.id });
  } catch (error) {
    logger.error('Failed to get video status', { error });
    socket.emit('error', {
      code: 'VIDEO_ERROR',
      message: error.message
    });
  }
}

/**
 * Handle get queue request
 * @param {Socket} socket - Socket.io socket instance
 */
async function handleGetQueue(socket) {
  try {
    const queue = await videoQueueService.getQueue();
    
    socket.emit('video:queue', {
      items: queue.map(item => ({
        tokenId: item.tokenId,
        status: item.status,
        requestedBy: item.requestedBy,
        priority: item.priority,
        position: item.position
      })),
      timestamp: new Date().toISOString()
    });

    logger.debug('Video queue sent', { socketId: socket.id, queueLength: queue.length });
  } catch (error) {
    logger.error('Failed to get video queue', { error });
    socket.emit('error', {
      code: 'VIDEO_ERROR',
      message: error.message
    });
  }
}

/**
 * Handle clear queue command
 * @param {Socket} socket - Socket.io socket instance
 * @param {Server} io - Socket.io server instance
 */
async function handleClearQueue(socket, io) {
  try {
    if (!socket.isGm) {
      socket.emit('error', {
        code: 'PERMISSION_DENIED',
        message: 'Only GM stations can clear the queue'
      });
      return;
    }

    await videoQueueService.clearQueue();
    
    io.emit('video:queue:cleared', {
      clearedBy: socket.deviceId,
      timestamp: new Date().toISOString()
    });

    logger.info('Video queue cleared', { socketId: socket.id });
  } catch (error) {
    logger.error('Failed to clear queue', { error });
    socket.emit('error', {
      code: 'VIDEO_ERROR',
      message: error.message
    });
  }
}

/**
 * Register video event handlers
 * @param {Socket} socket - Socket.io socket instance
 * @param {Server} io - Socket.io server instance
 */
function registerVideoHandlers(socket, io) {
  socket.on('video:play', (data) => handleVideoPlay(socket, data, io));
  socket.on('video:pause', () => handleVideoPause(socket, io));
  socket.on('video:resume', () => handleVideoResume(socket, io));
  socket.on('video:skip', () => handleVideoSkip(socket, io));
  socket.on('video:stop', () => handleVideoStop(socket, io));
  socket.on('video:status:request', () => handleVideoStatusRequest(socket));
  socket.on('video:queue:get', () => handleGetQueue(socket));
  socket.on('video:queue:clear', () => handleClearQueue(socket, io));
}

module.exports = {
  registerVideoHandlers,
  handleVideoPlay,
  handleVideoPause,
  handleVideoResume,
  handleVideoSkip,
  handleVideoStop,
  handleVideoStatusRequest,
  handleGetQueue,
  handleClearQueue
};