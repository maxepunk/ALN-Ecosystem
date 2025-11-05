/**
 * Socket Room Joining Tests (Phase 2.2 P1.2)
 * Tests that sockets join rooms in correct order after authentication
 */

const { handleGmIdentify } = require('../../../src/websocket/gmAuth');
const sessionService = require('../../../src/services/sessionService');
const stateService = require('../../../src/services/stateService');
const { resetAllServices } = require('../../helpers/service-reset');

describe('Socket Room Joining (Phase 2.2 P1.2)', () => {
  let mockSocket, mockIo;

  beforeEach(async () => {
    await resetAllServices();

    // Mock socket with join tracking
    mockSocket = {
      id: 'test-socket-id',
      isAuthenticated: true,
      deviceId: 'GM_001',
      deviceType: 'gm',
      version: '2.1.0',
      handshake: {
        address: '192.168.1.100',
        auth: {
          token: 'valid-token',
          deviceId: 'GM_001',
          deviceType: 'gm'
        }
      },
      join: jest.fn(),
      emit: jest.fn(),
      disconnect: jest.fn(),
      rooms: new Set(['test-socket-id']) // Default room is socket.id
    };

    mockIo = {
      emit: jest.fn(),
      to: jest.fn().mockReturnThis()
    };
  });

  describe('Room Join Order', () => {
    it('should join rooms in correct order: device → gm → teams', async () => {
      // PHASE 2.2 P1.2: Rooms must be joined in specific order
      // Create session with teams
      await sessionService.createSession({
        name: 'Test Session',
        teams: ['001', '002', '003']
      });

      await handleGmIdentify(mockSocket, {
        deviceId: 'GM_001',
        version: '2.1.0'
      }, mockIo);

      // Verify join() was called
      expect(mockSocket.join).toHaveBeenCalled();

      // Get all join calls in order
      const joinCalls = mockSocket.join.mock.calls.map(call => call[0]);

      // Find indices
      const deviceRoomIndex = joinCalls.findIndex(room => room === 'device:GM_001');
      const gmRoomIndex = joinCalls.findIndex(room => room === 'gm');
      const team001Index = joinCalls.findIndex(room => room === 'team:001');
      const team002Index = joinCalls.findIndex(room => room === 'team:002');
      const team003Index = joinCalls.findIndex(room => room === 'team:003');

      // CRITICAL: Verify order
      expect(deviceRoomIndex).toBeGreaterThanOrEqual(0); // Device room exists
      expect(gmRoomIndex).toBeGreaterThanOrEqual(0);     // GM room exists
      expect(team001Index).toBeGreaterThanOrEqual(0);   // Team rooms exist
      expect(team002Index).toBeGreaterThanOrEqual(0);
      expect(team003Index).toBeGreaterThanOrEqual(0);

      // Verify ORDER: device < gm < teams
      expect(deviceRoomIndex).toBeLessThan(gmRoomIndex);
      expect(gmRoomIndex).toBeLessThan(team001Index);
      expect(gmRoomIndex).toBeLessThan(team002Index);
      expect(gmRoomIndex).toBeLessThan(team003Index);
    });

    it('should join device-specific room', async () => {
      // PHASE 2.2 P1.2: Device room for targeted messages (like batch:ack)
      await handleGmIdentify(mockSocket, {
        deviceId: 'GM_001',
        version: '2.1.0'
      }, mockIo);

      expect(mockSocket.join).toHaveBeenCalledWith('device:GM_001');
    });

    it('should join gm room (not gm-stations)', async () => {
      // PHASE 2.2 P1.2: Use 'gm' room, not legacy 'gm-stations'
      await handleGmIdentify(mockSocket, {
        deviceId: 'GM_001',
        version: '2.1.0'
      }, mockIo);

      expect(mockSocket.join).toHaveBeenCalledWith('gm');

      // Verify old room name NOT used
      const joinCalls = mockSocket.join.mock.calls.map(call => call[0]);
      expect(joinCalls).not.toContain('gm-stations');
    });

    it('should join all team rooms when session active', async () => {
      // PHASE 2.2 P1.2: Join all team rooms for team-specific broadcasts
      await sessionService.createSession({
        name: 'Test Session',
        teams: ['001', '002', '003', '004']
      });

      await handleGmIdentify(mockSocket, {
        deviceId: 'GM_001',
        version: '2.1.0'
      }, mockIo);

      // Verify all team rooms joined
      expect(mockSocket.join).toHaveBeenCalledWith('team:001');
      expect(mockSocket.join).toHaveBeenCalledWith('team:002');
      expect(mockSocket.join).toHaveBeenCalledWith('team:003');
      expect(mockSocket.join).toHaveBeenCalledWith('team:004');
    });

    it('should not join team rooms when no session', async () => {
      // PHASE 2.2 P1.2: No team rooms if session doesn't exist yet
      // (GM connecting before session created)

      await handleGmIdentify(mockSocket, {
        deviceId: 'GM_001',
        version: '2.1.0'
      }, mockIo);

      // Should join device and gm rooms
      expect(mockSocket.join).toHaveBeenCalledWith('device:GM_001');
      expect(mockSocket.join).toHaveBeenCalledWith('gm');

      // But NOT team rooms
      const joinCalls = mockSocket.join.mock.calls.map(call => call[0]);
      const teamRooms = joinCalls.filter(room => room.startsWith('team:'));
      expect(teamRooms).toHaveLength(0);
    });
  });

  describe('Room Membership Verification', () => {
    it('should store room list on socket', async () => {
      // PHASE 2.2 P1.2: Track which rooms socket has joined
      await sessionService.createSession({
        name: 'Test Session',
        teams: ['001']
      });

      await handleGmIdentify(mockSocket, {
        deviceId: 'GM_001',
        version: '2.1.0'
      }, mockIo);

      // Socket should have rooms property
      expect(mockSocket.rooms).toBeDefined();

      // Should be a Set or Array
      expect(
        mockSocket.rooms instanceof Set || Array.isArray(mockSocket.rooms)
      ).toBe(true);
    });

    it('should join session room (legacy behavior maintained)', async () => {
      // PHASE 2.2 P1.2: Continue joining session room for compatibility
      const session = await sessionService.createSession({
        name: 'Test Session',
        teams: ['001']
      });

      await handleGmIdentify(mockSocket, {
        deviceId: 'GM_001',
        version: '2.1.0'
      }, mockIo);

      // Session room should still be joined
      expect(mockSocket.join).toHaveBeenCalledWith(`session:${session.id}`);
    });
  });

  describe('Different Device IDs', () => {
    it('should join device-specific room for each unique device', async () => {
      // PHASE 2.2 P1.2: Each device gets its own room
      const socket1 = { ...mockSocket, deviceId: 'GM_001', join: jest.fn() };
      const socket2 = { ...mockSocket, deviceId: 'GM_002', join: jest.fn() };

      await handleGmIdentify(socket1, { deviceId: 'GM_001' }, mockIo);
      await handleGmIdentify(socket2, { deviceId: 'GM_002' }, mockIo);

      expect(socket1.join).toHaveBeenCalledWith('device:GM_001');
      expect(socket2.join).toHaveBeenCalledWith('device:GM_002');
    });

    it('should join same gm room for all GM devices', async () => {
      // PHASE 2.2 P1.2: All GMs share 'gm' room for broadcasts
      const socket1 = { ...mockSocket, deviceId: 'GM_001', join: jest.fn() };
      const socket2 = { ...mockSocket, deviceId: 'GM_002', join: jest.fn() };

      await handleGmIdentify(socket1, { deviceId: 'GM_001' }, mockIo);
      await handleGmIdentify(socket2, { deviceId: 'GM_002' }, mockIo);

      expect(socket1.join).toHaveBeenCalledWith('gm');
      expect(socket2.join).toHaveBeenCalledWith('gm');
    });
  });

  describe('Edge Cases', () => {
    it('should handle session with no teams', async () => {
      // PHASE 2.2 P1.2: Session might not have teams yet
      await sessionService.createSession({
        name: 'Test Session',
        teams: []
      });

      await handleGmIdentify(mockSocket, {
        deviceId: 'GM_001',
        version: '2.1.0'
      }, mockIo);

      // Should join device and gm rooms
      expect(mockSocket.join).toHaveBeenCalledWith('device:GM_001');
      expect(mockSocket.join).toHaveBeenCalledWith('gm');

      // No team rooms (empty array)
      const joinCalls = mockSocket.join.mock.calls.map(call => call[0]);
      const teamRooms = joinCalls.filter(room => room.startsWith('team:'));
      expect(teamRooms).toHaveLength(0);
    });

    it('should handle session with undefined teams', async () => {
      // PHASE 2.2 P1.2: Defensive - teams might be undefined
      const session = await sessionService.createSession({
        name: 'Test Session'
      });

      // Manually set teams to undefined (edge case)
      session.teams = undefined;

      await handleGmIdentify(mockSocket, {
        deviceId: 'GM_001',
        version: '2.1.0'
      }, mockIo);

      // Should NOT throw error
      expect(mockSocket.join).toHaveBeenCalledWith('device:GM_001');
      expect(mockSocket.join).toHaveBeenCalledWith('gm');
    });
  });
});
