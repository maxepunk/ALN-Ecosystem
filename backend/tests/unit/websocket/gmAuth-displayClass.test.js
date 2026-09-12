/**
 * B0 BS.2 — display-class sockets at gm:identify (the BS.1 review's S1
 * residual, design doc §7 finding 1).
 *
 * A DISPLAY-class socket (the scoreboard's observe token: verified tier
 * 'device') is a read-only broadcast consumer. It must receive
 * broadcasts (join its rooms, get sync:full) but NEVER register as a GM
 * station — no session device entry, no canAcceptGmStation() capacity
 * spent. The decision reads the socket's VERIFIED tier (stamped from
 * token claims at the handshake), never a client-asserted name or
 * deviceType (red-team S2).
 */

const { handleGmIdentify } = require('../../../src/websocket/gmAuth');
const sessionService = require('../../../src/services/sessionService');
const { resetAllServices } = require('../../helpers/service-reset');

function makeSocket(overrides = {}) {
  return {
    id: 'test-socket-id',
    isAuthenticated: true,
    deviceId: 'SCOREBOARD_DISPLAY',
    deviceType: 'gm',
    version: '1.0.0',
    handshake: {
      address: '192.168.1.50',
      auth: { token: 'observe-token', deviceId: 'SCOREBOARD_DISPLAY', deviceType: 'gm' },
    },
    join: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
    rooms: new Set(['test-socket-id']),
    ...overrides,
  };
}

describe('gm:identify — display-class sockets (B0 BS.2)', () => {
  let mockIo;

  beforeEach(async () => {
    await resetAllServices();
    mockIo = { emit: jest.fn(), to: jest.fn().mockReturnThis() };
  });

  it('a display-class socket joins its rooms and gets sync:full, but never registers as a device', async () => {
    await sessionService.createSession({ name: 'Test Session', teams: [] });
    const socket = makeSocket({ tier: 'device', functions: ['observe'] });

    await handleGmIdentify(socket, { deviceId: 'SCOREBOARD_DISPLAY', version: '1.0.0' }, mockIo);

    expect(socket.disconnect).not.toHaveBeenCalled();
    expect(socket.join).toHaveBeenCalledWith('device:SCOREBOARD_DISPLAY');
    expect(socket.join).toHaveBeenCalledWith('gm');
    const syncCall = socket.emit.mock.calls.find(([event]) => event === 'sync:full');
    expect(syncCall).toBeDefined();

    const session = sessionService.getCurrentSession();
    const registered = (session.connectedDevices || [])
      .filter((d) => d.id === 'SCOREBOARD_DISPLAY');
    expect(registered).toHaveLength(0);
  });

  it('a display-class socket never consumes GM station capacity', async () => {
    await sessionService.createSession({ name: 'Test Session', teams: [] });
    const capacitySpy = jest.spyOn(sessionService, 'canAcceptGmStation')
      .mockReturnValue(false); // capacity exhausted — a GM would be refused
    try {
      const socket = makeSocket({ tier: 'device', functions: ['observe'] });
      await handleGmIdentify(socket, { deviceId: 'SCOREBOARD_DISPLAY', version: '1.0.0' }, mockIo);

      // The display socket connects anyway: capacity is a GM-station
      // budget and displays are not GM stations.
      expect(socket.disconnect).not.toHaveBeenCalled();
      expect(capacitySpy).not.toHaveBeenCalled();
    } finally {
      capacitySpy.mockRestore();
    }
  });

  it('an OPERATOR socket still takes the full path: device registered in the session', async () => {
    await sessionService.createSession({ name: 'Test Session', teams: [] });
    const socket = makeSocket({
      deviceId: 'GM_001', tier: 'operator',
      functions: ['view-content', 'observe', 'session-lifecycle', 'show-control', 'score-intervention'],
      handshake: { address: '192.168.1.10', auth: { token: 't', deviceId: 'GM_001', deviceType: 'gm' } },
    });

    await handleGmIdentify(socket, { deviceId: 'GM_001', version: '1.0.0' }, mockIo);

    expect(socket.disconnect).not.toHaveBeenCalled();
    const session = sessionService.getCurrentSession();
    const registered = (session.connectedDevices || []).filter((d) => d.id === 'GM_001');
    expect(registered).toHaveLength(1);
    expect(registered[0].type).toBe('gm');
  });
});
