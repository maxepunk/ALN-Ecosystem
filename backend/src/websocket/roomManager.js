/**
 * Room Manager WebSocket Handler
 * Manages Socket.io rooms for different device types and sessions
 */

const logger = require('../utils/logger');

// Room types
const ROOM_TYPES = {
  GM_STATIONS: 'gm-stations',
  PLAYERS: 'players',
  SESSION: 'session',
  DEVICE: 'device',
  ALL: 'all'
};

/**
 * Join device to appropriate rooms
 * @param {Socket} socket - Socket.io socket instance
 * @param {Object} deviceInfo - Device information
 */
async function joinDeviceToRooms(socket, deviceInfo) {
  try {
    const rooms = [];

    // Join device-specific room
    const deviceRoom = `${ROOM_TYPES.DEVICE}:${deviceInfo.deviceId}`;
    await socket.join(deviceRoom);
    rooms.push(deviceRoom);

    // Join type-specific room
    if (deviceInfo.type === 'gm') {
      await socket.join(ROOM_TYPES.GM_STATIONS);
      rooms.push(ROOM_TYPES.GM_STATIONS);
      socket.isGm = true;
    } else if (deviceInfo.type === 'player') {
      await socket.join(ROOM_TYPES.PLAYERS);
      rooms.push(ROOM_TYPES.PLAYERS);
      socket.isPlayer = true;
    }

    // Join session room if session is active
    if (deviceInfo.sessionId) {
      const sessionRoom = `${ROOM_TYPES.SESSION}:${deviceInfo.sessionId}`;
      await socket.join(sessionRoom);
      rooms.push(sessionRoom);
    }

    // All devices join the 'all' room for global broadcasts
    await socket.join(ROOM_TYPES.ALL);
    rooms.push(ROOM_TYPES.ALL);

    logger.info('Device joined rooms', {
      deviceId: deviceInfo.deviceId,
      rooms,
      socketId: socket.id
    });

    return rooms;
  } catch (error) {
    logger.error('Failed to join rooms', { error, deviceInfo });
    throw error;
  }
}

/**
 * Remove device from all rooms
 * @param {Socket} socket - Socket.io socket instance
 */
async function leaveAllRooms(socket) {
  try {
    const rooms = Array.from(socket.rooms);
    
    for (const room of rooms) {
      if (room !== socket.id) { // Don't leave the default room (socket.id)
        await socket.leave(room);
      }
    }

    logger.info('Device left all rooms', {
      deviceId: socket.deviceId,
      rooms,
      socketId: socket.id
    });
  } catch (error) {
    logger.error('Failed to leave rooms', { error, socketId: socket.id });
  }
}

/**
 * Get all sockets in a specific room
 * @param {Server} io - Socket.io server instance
 * @param {string} roomName - Room name
 * @returns {Promise<Array>} Array of socket IDs
 */
async function getSocketsInRoom(io, roomName) {
  try {
    const sockets = await io.in(roomName).fetchSockets();
    return sockets.map(s => ({
      id: s.id,
      deviceId: s.data?.deviceId || s.deviceId,
      deviceType: s.data?.deviceType || s.deviceType
    }));
  } catch (error) {
    logger.error('Failed to get sockets in room', { error, roomName });
    return [];
  }
}

/**
 * Get room statistics
 * @param {Server} io - Socket.io server instance
 * @returns {Promise<Object>} Room statistics
 */
async function getRoomStats(io) {
  try {
    const gmStations = await getSocketsInRoom(io, ROOM_TYPES.GM_STATIONS);
    const players = await getSocketsInRoom(io, ROOM_TYPES.PLAYERS);
    const all = await getSocketsInRoom(io, ROOM_TYPES.ALL);

    // Get session rooms
    const rooms = io.sockets.adapter.rooms;
    const sessionRooms = [];
    
    for (const [roomName, socketSet] of rooms.entries()) {
      if (roomName.startsWith(`${ROOM_TYPES.SESSION}:`)) {
        sessionRooms.push({
          name: roomName,
          size: socketSet.size
        });
      }
    }

    return {
      gmStations: gmStations.length,
      players: players.length,
      total: all.length,
      sessionRooms,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Failed to get room stats', { error });
    return {
      gmStations: 0,
      players: 0,
      total: 0,
      sessionRooms: [],
      error: error.message
    };
  }
}

/**
 * Broadcast to specific room with error handling
 * @param {Server} io - Socket.io server instance
 * @param {string} roomName - Room name
 * @param {string} event - Event name
 * @param {Object} data - Event data
 */
function broadcastToRoom(io, roomName, event, data) {
  try {
    io.to(roomName).emit(event, {
      ...data,
      timestamp: new Date().toISOString(),
      room: roomName
    });
    
    logger.debug('Broadcast to room', {
      room: roomName,
      event,
      dataKeys: Object.keys(data)
    });
  } catch (error) {
    logger.error('Failed to broadcast to room', {
      error,
      roomName,
      event
    });
  }
}

/**
 * Move socket between rooms
 * @param {Socket} socket - Socket.io socket instance
 * @param {string} fromRoom - Room to leave
 * @param {string} toRoom - Room to join
 */
async function moveSocketBetweenRooms(socket, fromRoom, toRoom) {
  try {
    if (fromRoom) {
      await socket.leave(fromRoom);
    }
    
    if (toRoom) {
      await socket.join(toRoom);
    }

    logger.info('Socket moved between rooms', {
      socketId: socket.id,
      fromRoom,
      toRoom
    });
  } catch (error) {
    logger.error('Failed to move socket between rooms', {
      error,
      socketId: socket.id,
      fromRoom,
      toRoom
    });
    throw error;
  }
}

/**
 * Get list of all active rooms
 * @param {Server} io - Socket.io server instance
 * @returns {Array} List of room names and sizes
 */
function getAllRooms(io) {
  const rooms = [];
  const adapter = io.sockets.adapter.rooms;

  for (const [roomName, socketSet] of adapter.entries()) {
    // Skip default socket ID rooms
    if (!adapter.sids?.has(roomName)) {
      rooms.push({
        name: roomName,
        size: socketSet.size,
        type: getRoomType(roomName)
      });
    }
  }

  return rooms;
}

/**
 * Get room type from room name
 * @param {string} roomName - Room name
 * @returns {string} Room type
 */
function getRoomType(roomName) {
  if (roomName === ROOM_TYPES.GM_STATIONS) return 'gm';
  if (roomName === ROOM_TYPES.PLAYERS) return 'player';
  if (roomName === ROOM_TYPES.ALL) return 'all';
  if (roomName.startsWith(`${ROOM_TYPES.SESSION}:`)) return 'session';
  if (roomName.startsWith(`${ROOM_TYPES.DEVICE}:`)) return 'device';
  return 'custom';
}

/**
 * Clean up empty rooms
 * @param {Server} io - Socket.io server instance
 */
function cleanupEmptyRooms(io) {
  const adapter = io.sockets.adapter.rooms;
  let cleaned = 0;

  for (const [roomName, socketSet] of adapter.entries()) {
    if (socketSet.size === 0 && !adapter.sids?.has(roomName)) {
      // Room is empty and not a socket ID room
      adapter.rooms.delete(roomName);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    logger.info('Cleaned up empty rooms', { count: cleaned });
  }
}

/**
 * Register room management handlers
 * @param {Socket} socket - Socket.io socket instance
 * @param {Server} io - Socket.io server instance
 */
function registerRoomHandlers(socket, io) {
  // Handle room join requests
  socket.on('room:join', async (roomName) => {
    try {
      await socket.join(roomName);
      socket.emit('room:joined', { room: roomName });
      
      // Notify others in room
      socket.to(roomName).emit('room:member:joined', {
        socketId: socket.id,
        deviceId: socket.deviceId
      });
    } catch (error) {
      socket.emit('error', {
        code: 'ROOM_ERROR',
        message: `Failed to join room: ${error.message}`
      });
    }
  });

  // Handle room leave requests
  socket.on('room:leave', async (roomName) => {
    try {
      await socket.leave(roomName);
      socket.emit('room:left', { room: roomName });
      
      // Notify others in room
      io.to(roomName).emit('room:member:left', {
        socketId: socket.id,
        deviceId: socket.deviceId
      });
    } catch (error) {
      socket.emit('error', {
        code: 'ROOM_ERROR',
        message: `Failed to leave room: ${error.message}`
      });
    }
  });

  // Handle room stats request
  socket.on('room:stats', async () => {
    const stats = await getRoomStats(io);
    socket.emit('room:stats', stats);
  });

  // Handle list rooms request
  socket.on('room:list', () => {
    const rooms = getAllRooms(io);
    socket.emit('room:list', { rooms });
  });
}

module.exports = {
  ROOM_TYPES,
  joinDeviceToRooms,
  leaveAllRooms,
  getSocketsInRoom,
  getRoomStats,
  broadcastToRoom,
  moveSocketBetweenRooms,
  getAllRooms,
  cleanupEmptyRooms,
  registerRoomHandlers
};