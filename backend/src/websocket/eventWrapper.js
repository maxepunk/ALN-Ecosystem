/**
 * WebSocket Event Wrapper
 * Ensures all WebSocket events follow the contract format
 */

const logger = require('../utils/logger');

/**
 * Wrap event data in contract-compliant format
 * @param {string} eventName - The event name
 * @param {Object} data - The event data
 * @returns {Object} Contract-compliant event structure
 */
function wrapEvent(eventName, data) {
  return {
    event: eventName,
    data: data,
    timestamp: new Date().toISOString()
  };
}

/**
 * Emit a contract-compliant event
 * @param {Socket|Server} emitter - Socket or io instance
 * @param {string} eventName - The event name
 * @param {Object} data - The event data
 */
function emitWrapped(emitter, eventName, data) {
  const wrappedEvent = wrapEvent(eventName, data);
  emitter.emit(eventName, wrappedEvent);
}

/**
 * Emit to a room with contract-compliant format
 * @param {Server} io - Socket.io server instance
 * @param {string} room - Room name
 * @param {string} eventName - The event name
 * @param {Object} data - The event data
 */
function emitToRoom(io, room, eventName, data) {
  const wrappedEvent = wrapEvent(eventName, data);
  io.to(room).emit(eventName, wrappedEvent);
}

module.exports = {
  wrapEvent,
  emitWrapped,
  emitToRoom
};