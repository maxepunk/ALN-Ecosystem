/**
 * Train-review MAJOR 1 (LA-1) + LA-2 — display-class sockets and the
 * session room, at SESSION CREATION time (initializeSessionDevices).
 *
 * The other ordering (display connects after the session exists) is
 * pinned in gmAuth-displayClass.test.js. This file pins the
 * session-created-while-display-connected ordering:
 *  - the display socket JOINS the new session room (broadcast
 *    delivery — it is a read-only broadcast consumer), and
 *  - it is NEVER registered as a session device / GM station (LA-2:
 *    initializeSessionDevices previously undid the ruled carve-out).
 */

const { setupBroadcastListeners, cleanupBroadcastListeners } = require('../../../src/websocket/broadcasts');
const sessionService = require('../../../src/services/sessionService');
const { resetAllServices } = require('../../helpers/service-reset');
const {
  createMockTransactionService,
  createMockVideoQueueService,
  createMockOfflineQueueService,
} = require('../../helpers/mocks');

function makeConnectedSocket(overrides = {}) {
  return {
    id: `sock-${overrides.deviceId || 'x'}`,
    isAuthenticated: true,
    version: '1.0.0',
    handshake: { address: '192.168.1.60' },
    join: jest.fn(),
    leave: jest.fn(),
    emit: jest.fn(),
    rooms: new Set(),
    ...overrides,
  };
}

describe('initializeSessionDevices — display-class sockets (MAJOR 1 / LA-2)', () => {
  let mockIo;
  let displaySocket;
  let gmSocket;

  beforeEach(async () => {
    await resetAllServices();
    displaySocket = makeConnectedSocket({
      deviceId: 'SCOREBOARD_DISPLAY',
      deviceType: 'gm',
      tier: 'device',
      functions: ['observe'],
    });
    gmSocket = makeConnectedSocket({
      deviceId: 'GM_001',
      deviceType: 'gm',
      tier: 'operator',
    });
    mockIo = {
      emit: jest.fn(),
      to: jest.fn().mockReturnThis(),
      sockets: {
        sockets: new Map([
          [displaySocket.id, displaySocket],
          [gmSocket.id, gmSocket],
        ]),
        adapter: { rooms: new Map() },
      },
    };
    setupBroadcastListeners(mockIo, {
      sessionService,
      transactionService: createMockTransactionService(),
      videoQueueService: createMockVideoQueueService(),
      offlineQueueService: createMockOfflineQueueService(),
    });
  });

  afterEach(() => {
    cleanupBroadcastListeners();
  });

  it('registers the GM as a session device but NEVER the display; BOTH join the session room', async () => {
    const session = await sessionService.createSession({ name: 'Test Session', teams: [] });
    // session:created listener is async — flush it
    await new Promise((resolve) => setImmediate(resolve));

    const devices = sessionService.getCurrentSession().connectedDevices || [];
    expect(devices.filter((d) => d.id === 'GM_001')).toHaveLength(1);
    // LA-2: the display must not spend GM-station identity/capacity
    expect(devices.filter((d) => d.id === 'SCOREBOARD_DISPLAY')).toHaveLength(0);

    // MAJOR 1: broadcast delivery — both sockets are in the session room
    expect(gmSocket.join).toHaveBeenCalledWith(`session:${session.id}`);
    expect(displaySocket.join).toHaveBeenCalledWith(`session:${session.id}`);
  });
});
