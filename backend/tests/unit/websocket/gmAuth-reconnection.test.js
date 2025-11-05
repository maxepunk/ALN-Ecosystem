/**
 * GM Auth Reconnection Tests (Phase 2.1 P1.1)
 * Tests that sync:full includes deviceScannedTokens for state restoration
 */

const { handleGmIdentify } = require('../../../src/websocket/gmAuth');
const sessionService = require('../../../src/services/sessionService');
const { resetAllServices } = require('../../helpers/service-reset');

describe('GM Auth - Reconnection State Restoration (Phase 2.1 P1.1)', () => {
  let mockSocket, mockIo, session;

  beforeEach(async () => {
    await resetAllServices();

    // Mock socket
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
      rooms: new Set(['test-socket-id'])
    };

    mockIo = {
      emit: jest.fn(),
      to: jest.fn().mockReturnThis()
    };

    // Create session with teams
    session = await sessionService.createSession({
      name: 'Reconnection Test Session',
      teams: ['001', '002']
    });
  });

  describe('deviceScannedTokens in sync:full', () => {
    it('should include empty array when device has not scanned anything', async () => {
      // PHASE 2.1 P1.1: Even with no scans, include empty deviceScannedTokens array

      await handleGmIdentify(mockSocket, {
        deviceId: 'GM_001',
        version: '2.1.0'
      }, mockIo);

      // Find sync:full emit call
      const syncFullCall = mockSocket.emit.mock.calls.find(
        call => call[0] === 'sync:full'
      );

      expect(syncFullCall).toBeDefined();
      const eventData = syncFullCall[1];

      // Verify deviceScannedTokens is present
      expect(eventData.data).toHaveProperty('deviceScannedTokens');
      expect(eventData.data.deviceScannedTokens).toEqual([]);
    });

    it('should include deviceScannedTokens when device has scanned tokens', async () => {
      // PHASE 2.1 P1.1: Include device-specific scanned tokens

      // Scan tokens as GM_001
      session.addDeviceScannedToken('GM_001', 'jaw011');
      session.addDeviceScannedToken('GM_001', 'kaa001');
      session.addDeviceScannedToken('GM_001', 'rat001');

      await handleGmIdentify(mockSocket, {
        deviceId: 'GM_001',
        version: '2.1.0'
      }, mockIo);

      // Find sync:full emit call
      const syncFullCall = mockSocket.emit.mock.calls.find(
        call => call[0] === 'sync:full'
      );

      expect(syncFullCall).toBeDefined();
      const eventData = syncFullCall[1];

      // Verify deviceScannedTokens contains scanned tokens
      expect(eventData.data.deviceScannedTokens).toBeDefined();
      expect(Array.isArray(eventData.data.deviceScannedTokens)).toBe(true);
      expect(eventData.data.deviceScannedTokens).toContain('jaw011');
      expect(eventData.data.deviceScannedTokens).toContain('kaa001');
      expect(eventData.data.deviceScannedTokens).toContain('rat001');
      expect(eventData.data.deviceScannedTokens).toHaveLength(3);
    });

    it('should only include tokens scanned by THIS device', async () => {
      // PHASE 2.1 P1.1: Device-specific filtering (GM_001 should not see GM_002 tokens)

      // GM_001 scanned these
      session.addDeviceScannedToken('GM_001', 'jaw011');
      session.addDeviceScannedToken('GM_001', 'kaa001');

      // GM_002 scanned these (should NOT appear for GM_001)
      session.addDeviceScannedToken('GM_002', 'rat001');
      session.addDeviceScannedToken('GM_002', 'bal001');

      await handleGmIdentify(mockSocket, {
        deviceId: 'GM_001',
        version: '2.1.0'
      }, mockIo);

      // Find sync:full emit call
      const syncFullCall = mockSocket.emit.mock.calls.find(
        call => call[0] === 'sync:full'
      );

      const eventData = syncFullCall[1];

      // Verify only GM_001's tokens
      expect(eventData.data.deviceScannedTokens).toEqual(
        expect.arrayContaining(['jaw011', 'kaa001'])
      );
      expect(eventData.data.deviceScannedTokens).not.toContain('rat001');
      expect(eventData.data.deviceScannedTokens).not.toContain('bal001');
      expect(eventData.data.deviceScannedTokens).toHaveLength(2);
    });

    it('should convert Set to Array for deviceScannedTokens', async () => {
      // PHASE 2.1 P1.1: Session stores as Set, must convert to Array for JSON

      session.addDeviceScannedToken('GM_001', 'jaw011');
      session.addDeviceScannedToken('GM_001', 'kaa001');

      await handleGmIdentify(mockSocket, {
        deviceId: 'GM_001',
        version: '2.1.0'
      }, mockIo);

      const syncFullCall = mockSocket.emit.mock.calls.find(
        call => call[0] === 'sync:full'
      );

      const eventData = syncFullCall[1];

      // Must be an array (not Set)
      expect(Array.isArray(eventData.data.deviceScannedTokens)).toBe(true);

      // Should be serializable to JSON (no circular refs, no Sets)
      expect(() => JSON.stringify(eventData.data.deviceScannedTokens)).not.toThrow();
    });
  });

  describe('reconnection flag', () => {
    it('should include reconnection: false for first connection', async () => {
      // PHASE 2.1 P1.1: First connection is NOT a reconnection

      await handleGmIdentify(mockSocket, {
        deviceId: 'GM_001',
        version: '2.1.0'
      }, mockIo);

      const syncFullCall = mockSocket.emit.mock.calls.find(
        call => call[0] === 'sync:full'
      );

      const eventData = syncFullCall[1];

      // Reconnection flag should be present and false
      expect(eventData.data).toHaveProperty('reconnection');
      expect(eventData.data.reconnection).toBe(false);
    });

    it('should include reconnection: true when socket.recovered is true', async () => {
      // PHASE 2.1 P1.1: Socket.io sets socket.recovered on reconnection

      mockSocket.recovered = true; // Socket.io sets this on recovery

      await handleGmIdentify(mockSocket, {
        deviceId: 'GM_001',
        version: '2.1.0'
      }, mockIo);

      const syncFullCall = mockSocket.emit.mock.calls.find(
        call => call[0] === 'sync:full'
      );

      const eventData = syncFullCall[1];

      // Reconnection flag should be true
      expect(eventData.data.reconnection).toBe(true);
    });
  });

  describe('Logging', () => {
    it('should log scanned token count on reconnection', async () => {
      // PHASE 2.1 P1.1: Log useful debug info

      session.addDeviceScannedToken('GM_001', 'jaw011');
      session.addDeviceScannedToken('GM_001', 'kaa001');
      session.addDeviceScannedToken('GM_001', 'rat001');

      // Spy on logger (if available)
      const logger = require('../../../src/utils/logger');
      const logSpy = jest.spyOn(logger, 'info');

      await handleGmIdentify(mockSocket, {
        deviceId: 'GM_001',
        version: '2.1.0'
      }, mockIo);

      // Should log scanned count
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('synchronized'),
        expect.objectContaining({
          deviceId: 'GM_001',
          scannedCount: 3
        })
      );

      logSpy.mockRestore();
    });
  });

  describe('No Session (Edge Case)', () => {
    it('should include empty deviceScannedTokens when no session exists', async () => {
      // PHASE 2.1 P1.1: GM connecting before session created

      // End the session (simulate no active session)
      await sessionService.endSession();

      await handleGmIdentify(mockSocket, {
        deviceId: 'GM_001',
        version: '2.1.0'
      }, mockIo);

      const syncFullCall = mockSocket.emit.mock.calls.find(
        call => call[0] === 'sync:full'
      );

      const eventData = syncFullCall[1];

      // Should include empty array (no session = no scans)
      expect(eventData.data.deviceScannedTokens).toEqual([]);
    });
  });
});
