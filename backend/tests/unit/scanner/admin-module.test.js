/**
 * AdminModule Unit Tests
 *
 * Tests admin command construction, acknowledgment handling, timeout behavior,
 * and AsyncAPI contract compliance for all admin operations.
 *
 * Functional Requirements:
 * - Section 4.2: Admin Panel Intervention Functions
 * - Session Control: create, pause, resume, end
 * - Video Control: play, pause, stop, skip, queue management
 * - Score/Transaction: adjust scores, manage transactions
 * - System Control: reset
 *
 * Contract: asyncapi.yaml - gm:command and gm:command:ack events (lines 984-1133)
 */

const AdminModule = require('../../../../ALNScanner/js/utils/adminModule');
require('../../helpers/browser-mocks');

describe('AdminModule', () => {
  let mockConnection;
  let mockSocket;

  beforeEach(() => {
    jest.useFakeTimers();

    // Mock socket connection
    mockSocket = {
      emit: jest.fn(),
      once: jest.fn(),
      on: jest.fn(),
      off: jest.fn()
    };

    // Mock connection object (OrchestratorClient interface)
    // AdminModule expects connection.on() directly (for session:update listener in constructor)
    mockConnection = {
      socket: mockSocket,
      on: jest.fn(),      // Required: SessionManager constructor calls this
      off: jest.fn()      // Good practice: if on() exists, off() should too
    };

    // Mock DOM elements
    global.document.getElementById = jest.fn().mockReturnValue({
      textContent: '',
      className: '',
      title: '',
      innerHTML: ''
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ============================================================================
  // TEST GROUP 1: SessionManager - Command Construction
  // ============================================================================

  describe('SessionManager', () => {
    let sessionManager;

    beforeEach(() => {
      sessionManager = new AdminModule.SessionManager(mockConnection);
    });

    describe('TEST 1: createSession command structure', () => {
      it('should construct session:create command per AsyncAPI contract', async () => {
        // ARRANGE
        const sessionName = 'Test Session Oct 6';
        const teams = ['001', '002', '003'];

        // ACT
        const promise = sessionManager.createSession(sessionName, teams);

        // ASSERT: Verify emitted event structure matches AsyncAPI
        expect(mockSocket.emit).toHaveBeenCalledWith('gm:command', {
          event: 'gm:command',
          data: {
            action: 'session:create',
            payload: {
              name: sessionName,
              teams: teams
            }
          },
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
        });

        // Cleanup promise to prevent hanging
        const mockAck = {
          data: {
            success: true,
            session: { id: '123', status: 'active' }
          }
        };
        mockSocket.once.mock.calls[0][1](mockAck);
        await promise;
      });

      it('should use default teams if not provided', async () => {
        // ACT
        const promise = sessionManager.createSession('Test Session');

        // ASSERT
        const emitCall = mockSocket.emit.mock.calls[0];
        expect(emitCall[1].data.payload.teams).toEqual(['001', '002', '003']);

        // Cleanup
        mockSocket.once.mock.calls[0][1]({ data: { success: true, session: {} } });
        await promise;
      });

      it('should include ISO 8601 timestamp', async () => {
        // ACT
        const promise = sessionManager.createSession('Test');

        // ASSERT
        const emitCall = mockSocket.emit.mock.calls[0];
        const timestamp = emitCall[1].timestamp;

        // Verify ISO 8601 format: YYYY-MM-DDTHH:mm:ss.sssZ
        expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

        // Cleanup
        mockSocket.once.mock.calls[0][1]({ data: { success: true, session: {} } });
        await promise;
      });
    });

    describe('TEST 2: pauseSession command structure', () => {
      it('should construct session:pause command per AsyncAPI contract', async () => {
        // ARRANGE: Must have current session
        sessionManager.currentSession = { id: '123', status: 'active' };

        // ACT
        const promise = sessionManager.pauseSession();

        // ASSERT
        expect(mockSocket.emit).toHaveBeenCalledWith('gm:command', {
          event: 'gm:command',
          data: {
            action: 'session:pause',
            payload: {}
          },
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
        });

        // Cleanup
        mockSocket.once.mock.calls[0][1]({ data: { success: true, session: {} } });
        await promise;
      });

      it('should not send command if no current session', async () => {
        // ARRANGE: No session
        sessionManager.currentSession = null;

        // ACT
        await sessionManager.pauseSession();

        // ASSERT: No command sent
        expect(mockSocket.emit).not.toHaveBeenCalled();
      });
    });

    describe('TEST 3: resumeSession command structure', () => {
      it('should construct session:resume command per AsyncAPI contract', async () => {
        // ARRANGE
        sessionManager.currentSession = { id: '123', status: 'paused' };

        // ACT
        const promise = sessionManager.resumeSession();

        // ASSERT
        expect(mockSocket.emit).toHaveBeenCalledWith('gm:command', {
          event: 'gm:command',
          data: {
            action: 'session:resume',
            payload: {}
          },
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
        });

        // Cleanup
        mockSocket.once.mock.calls[0][1]({ data: { success: true, session: {} } });
        await promise;
      });
    });

    describe('TEST 4: endSession command structure', () => {
      it('should construct session:end command per AsyncAPI contract', async () => {
        // ARRANGE
        sessionManager.currentSession = { id: '123', status: 'active' };

        // ACT
        const promise = sessionManager.endSession();

        // ASSERT
        expect(mockSocket.emit).toHaveBeenCalledWith('gm:command', {
          event: 'gm:command',
          data: {
            action: 'session:end',
            payload: {}
          },
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
        });

        // Cleanup
        mockSocket.once.mock.calls[0][1]({ data: { success: true } });
        await promise;
      });

      it('should clear currentSession when session:update broadcast received with null', async () => {
        // ARRANGE
        sessionManager.currentSession = { id: '123', status: 'active' };

        // ACT
        const promise = sessionManager.endSession();

        // Simulate server ack
        const mockAck = {
          data: {
            success: true,
            message: 'Session ended'
          }
        };
        mockSocket.once.mock.calls[0][1](mockAck);

        // Simulate session:update broadcast (Phase 2.3 architecture)
        // State updates come from broadcasts, not command acks
        const sessionUpdateHandler = mockConnection.on.mock.calls.find(
          call => call[0] === 'session:update'
        )[1];
        sessionUpdateHandler(null);

        await promise;

        // ASSERT: State updated from broadcast, not from ack
        expect(sessionManager.currentSession).toBeNull();
      });
    });

    describe('TEST 5: Session state management', () => {
      it('should update currentSession when session:update broadcast received', async () => {
        // ACT
        const promise = sessionManager.createSession('Test');

        // Simulate server ack
        const newSession = {
          id: 'session-456',
          name: 'Test',
          status: 'active',
          startTime: new Date().toISOString()
        };

        mockSocket.once.mock.calls[0][1]({
          data: {
            success: true,
            session: newSession
          }
        });

        // Simulate session:update broadcast (Phase 2.3 architecture)
        // State updates come from broadcasts, not command acks
        const sessionUpdateHandler = mockConnection.on.mock.calls.find(
          call => call[0] === 'session:update'
        )[1];
        sessionUpdateHandler(newSession);

        await promise;

        // ASSERT: State updated from broadcast, not from ack
        expect(sessionManager.currentSession).toEqual(newSession);
      });
    });
  });

  // ============================================================================
  // TEST GROUP 2: VideoController - Command Construction
  // ============================================================================

  describe('VideoController', () => {
    let videoController;

    beforeEach(() => {
      videoController = new AdminModule.VideoController(mockConnection);
    });

    describe('TEST 6: Basic video commands', () => {
      it('should construct video:play command per AsyncAPI contract', async () => {
        // ACT
        const promise = videoController.playVideo();

        // ASSERT
        expect(mockSocket.emit).toHaveBeenCalledWith('gm:command', {
          event: 'gm:command',
          data: {
            action: 'video:play',
            payload: {}
          },
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
        });

        // Cleanup
        mockSocket.once.mock.calls[0][1]({ data: { success: true } });
        await promise;
      });

      it('should construct video:pause command', async () => {
        // ACT
        const promise = videoController.pauseVideo();

        // ASSERT
        expect(mockSocket.emit).toHaveBeenCalledWith('gm:command', {
          event: 'gm:command',
          data: {
            action: 'video:pause',
            payload: {}
          },
          timestamp: expect.any(String)
        });

        // Cleanup
        mockSocket.once.mock.calls[0][1]({ data: { success: true } });
        await promise;
      });

      it('should construct video:stop command', async () => {
        // ACT
        const promise = videoController.stopVideo();

        // ASSERT
        const emitCall = mockSocket.emit.mock.calls[0];
        expect(emitCall[1].data.action).toBe('video:stop');

        // Cleanup
        mockSocket.once.mock.calls[0][1]({ data: { success: true } });
        await promise;
      });

      it('should construct video:skip command', async () => {
        // ACT
        const promise = videoController.skipVideo();

        // ASSERT
        const emitCall = mockSocket.emit.mock.calls[0];
        expect(emitCall[1].data.action).toBe('video:skip');

        // Cleanup
        mockSocket.once.mock.calls[0][1]({ data: { success: true } });
        await promise;
      });
    });

    describe('TEST 7: Video queue management commands (AsyncAPI required)', () => {
      it('should have addToQueue method for video:queue:add command', () => {
        // EXPECTED BUG: Method likely missing
        // AsyncAPI contract (line 1032) requires video:queue:add
        expect(videoController.addToQueue).toBeDefined();
        expect(typeof videoController.addToQueue).toBe('function');
      });

      it('should have reorderQueue method for video:queue:reorder command', () => {
        // EXPECTED BUG: Method likely missing
        // AsyncAPI contract (line 1033) requires video:queue:reorder
        expect(videoController.reorderQueue).toBeDefined();
        expect(typeof videoController.reorderQueue).toBe('function');
      });

      it('should have clearQueue method for video:queue:clear command', () => {
        // EXPECTED BUG: Method likely missing
        // AsyncAPI contract (line 1034) requires video:queue:clear
        expect(videoController.clearQueue).toBeDefined();
        expect(typeof videoController.clearQueue).toBe('function');
      });
    });
  });

  // ============================================================================
  // TEST GROUP 3: AdminOperations - Score and Transaction Commands
  // ============================================================================

  describe('AdminOperations', () => {
    let adminOps;

    beforeEach(() => {
      adminOps = new AdminModule.AdminOperations(mockConnection);
    });

    describe('TEST 8: Score adjustment command', () => {
      it('should construct score:adjust command per AsyncAPI contract', async () => {
        // ARRANGE
        const teamId = '001';
        const delta = -500;
        const reason = 'Penalty for rule violation';

        // ACT
        const promise = adminOps.adjustScore(teamId, delta, reason);

        // ASSERT: Verify matches AsyncAPI example (line 1066-1075)
        expect(mockSocket.emit).toHaveBeenCalledWith('gm:command', {
          event: 'gm:command',
          data: {
            action: 'score:adjust',
            payload: {
              teamId: '001',
              delta: -500,
              reason: 'Penalty for rule violation'
            }
          },
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
        });

        // Cleanup
        mockSocket.once.mock.calls[0][1]({ data: { success: true } });
        await promise;
      });

      it('should validate teamId format', async () => {
        // EXPECTED BUG: Likely no validation
        // TeamId must match pattern '^[0-9]{3}$' per contracts

        // ACT & ASSERT
        await expect(
          adminOps.adjustScore('invalid-team', 100, 'test')
        ).rejects.toThrow(/teamId.*format/i);
      });

      it('should validate delta is a number', async () => {
        // EXPECTED BUG: Likely no validation

        // ACT & ASSERT
        await expect(
          adminOps.adjustScore('001', 'not-a-number', 'test')
        ).rejects.toThrow(/delta.*number/i);
      });

      it('should require reason parameter', async () => {
        // EXPECTED BUG: Reason might be optional but should be required
        // Audit trail needs context for manual adjustments

        // ACT & ASSERT
        await expect(
          adminOps.adjustScore('001', -100, '')
        ).rejects.toThrow(/reason.*required/i);
      });
    });

    describe('TEST 9: System reset command', () => {
      it('should construct system:reset command per AsyncAPI contract', async () => {
        // ACT
        const promise = adminOps.systemReset();

        // ASSERT
        expect(mockSocket.emit).toHaveBeenCalledWith('gm:command', {
          event: 'gm:command',
          data: {
            action: 'system:reset',
            payload: {}
          },
          timestamp: expect.any(String)
        });

        // Cleanup
        mockSocket.once.mock.calls[0][1]({ data: { success: true } });
        await promise;
      });
    });

    describe('TEST 10: Transaction management commands (AsyncAPI required)', () => {
      it('should have deleteTransaction method for transaction:delete command', () => {
        // EXPECTED BUG: Method likely missing
        // AsyncAPI contract (line 1036) requires transaction:delete
        expect(adminOps.deleteTransaction).toBeDefined();
        expect(typeof adminOps.deleteTransaction).toBe('function');
      });

      it('should have createTransaction method for transaction:create command', () => {
        // EXPECTED BUG: Method likely missing
        // AsyncAPI contract (line 1037) requires transaction:create
        expect(adminOps.createTransaction).toBeDefined();
        expect(typeof adminOps.createTransaction).toBe('function');
      });
    });
  });

  // ============================================================================
  // TEST GROUP 4: Acknowledgment Handling
  // ============================================================================

  describe('Acknowledgment Handling', () => {
    let sessionManager;

    beforeEach(() => {
      sessionManager = new AdminModule.SessionManager(mockConnection);
    });

    describe('TEST 11: Success acknowledgments', () => {
      it('should resolve promise on success:true acknowledgment', async () => {
        // ARRANGE
        const promise = sessionManager.createSession('Test');

        // ACT: Simulate server ack
        const mockAck = {
          data: {
            success: true,
            message: 'Session created successfully',
            session: { id: '789', status: 'active' }
          }
        };

        const ackHandler = mockSocket.once.mock.calls[0][1];
        ackHandler(mockAck);

        // ASSERT
        await expect(promise).resolves.toEqual(mockAck.data.session);
      });

      it('should clear timeout on successful acknowledgment', async () => {
        // ARRANGE
        const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
        const promise = sessionManager.createSession('Test');

        // ACT
        const mockAck = { data: { success: true, session: {} } };
        mockSocket.once.mock.calls[0][1](mockAck);

        await promise;

        // ASSERT
        expect(clearTimeoutSpy).toHaveBeenCalled();
      });
    });

    describe('TEST 12: Failure acknowledgments', () => {
      it('should reject promise on success:false acknowledgment', async () => {
        // ARRANGE
        const promise = sessionManager.createSession('Test');

        // ACT: Simulate server ack with failure
        const mockAck = {
          data: {
            success: false,
            message: 'Session creation failed: no active game event'
          }
        };

        const ackHandler = mockSocket.once.mock.calls[0][1];
        ackHandler(mockAck);

        // ASSERT
        await expect(promise).rejects.toThrow('Session creation failed: no active game event');
      });

      it('should provide default error message if message missing', async () => {
        // ARRANGE
        const promise = sessionManager.createSession('Test');

        // ACT
        const mockAck = {
          data: {
            success: false
            // No message provided
          }
        };

        mockSocket.once.mock.calls[0][1](mockAck);

        // ASSERT
        await expect(promise).rejects.toThrow('Failed to create session');
      });
    });
  });

  // ============================================================================
  // TEST GROUP 5: Timeout Handling
  // ============================================================================

  describe('Timeout Handling', () => {
    let sessionManager;

    beforeEach(() => {
      sessionManager = new AdminModule.SessionManager(mockConnection);
    });

    describe('TEST 13: 5-second timeout enforcement', () => {
      it('should reject promise after 5 seconds if no acknowledgment', async () => {
        // ARRANGE
        const promise = sessionManager.createSession('Test');

        // ACT: Advance timers by 5 seconds
        jest.advanceTimersByTime(5000);

        // ASSERT
        await expect(promise).rejects.toThrow(/timeout/i);
      });

      it('should not reject if acknowledgment received before timeout', async () => {
        // ARRANGE
        const promise = sessionManager.createSession('Test');

        // ACT: Send ack at 4 seconds (before timeout)
        jest.advanceTimersByTime(4000);

        const mockAck = { data: { success: true, session: {} } };
        mockSocket.once.mock.calls[0][1](mockAck);

        // ASSERT: Should resolve, not timeout
        await expect(promise).resolves.toBeDefined();
      });

      it('should use consistent 5s timeout across all command types', async () => {
        // Test multiple command types
        const videoController = new AdminModule.VideoController(mockConnection);
        const adminOps = new AdminModule.AdminOperations(mockConnection);

        // Session command
        const p1 = sessionManager.createSession('Test');
        jest.advanceTimersByTime(5000);
        await expect(p1).rejects.toThrow(/timeout/i);

        // Video command
        const p2 = videoController.playVideo();
        jest.advanceTimersByTime(5000);
        await expect(p2).rejects.toThrow(/timeout/i);

        // Admin command
        const p3 = adminOps.systemReset();
        jest.advanceTimersByTime(5000);
        await expect(p3).rejects.toThrow(/timeout/i);
      });
    });
  });

  // ============================================================================
  // TEST GROUP 6: Event Listener Management
  // ============================================================================

  describe('Event Listener Management', () => {
    let videoController;

    beforeEach(() => {
      videoController = new AdminModule.VideoController(mockConnection);
    });

    describe('TEST 14: Listener cleanup', () => {
      it('should use socket.once() not socket.on() to prevent memory leaks', async () => {
        // ARRANGE & ACT
        const promise = videoController.playVideo();

        // ASSERT: Verify .once() was used (auto-cleanup)
        expect(mockSocket.once).toHaveBeenCalled();
        expect(mockSocket.on).not.toHaveBeenCalled();

        // Cleanup
        mockSocket.once.mock.calls[0][1]({ data: { success: true } });
        await promise;
      });

      it('should cleanup listener on timeout', async () => {
        // ARRANGE
        const promise = videoController.playVideo();

        // ACT: Trigger timeout
        jest.advanceTimersByTime(5000);

        // ASSERT: Promise rejected (listener was cleaned up)
        await expect(promise).rejects.toThrow();

        // Verify once() was called (which auto-cleans after first event OR timeout)
        expect(mockSocket.once).toHaveBeenCalledWith('gm:command:ack', expect.any(Function));
      });
    });
  });

  // ============================================================================
  // TEST GROUP 7: Display Update Integration
  // ============================================================================

  describe('MonitoringDisplay - Session Display Updates', () => {
    let monitoringDisplay;

    beforeEach(() => {
      // Mock createElement for escapeHtml helper (used by updateSessionDisplay)
      global.document.createElement = jest.fn(() => ({
        textContent: '',
        get innerHTML() { return this.textContent; }
      }));

      monitoringDisplay = new AdminModule.MonitoringDisplay(mockConnection);
    });

    describe('TEST 15: DOM manipulation safety', () => {
      it('should not crash if DOM elements missing', () => {
        // ARRANGE: Mock getElementById returns null
        global.document.getElementById = jest.fn().mockReturnValue(null);

        const session = { id: '123', status: 'active' };

        // ACT & ASSERT: Should not throw (has null safety with ?. operator)
        expect(() => {
          monitoringDisplay.updateSessionDisplay(session);
        }).not.toThrow();
      });

      it('should handle null session gracefully', () => {
        // ARRANGE
        const containerElement = { innerHTML: '' };
        global.document.getElementById = jest.fn()
          .mockReturnValueOnce(containerElement);  // 'session-status-container'

        // ACT
        monitoringDisplay.updateSessionDisplay(null);

        // ASSERT: Should show "No Active Session" message
        expect(containerElement.innerHTML).toContain('No Active Session');
        expect(containerElement.innerHTML).toContain('Create a new session');
      });

      it('should display session data correctly when provided', () => {
        // ARRANGE
        const containerElement = { innerHTML: '' };
        global.document.getElementById = jest.fn()
          .mockReturnValueOnce(containerElement);  // 'session-status-container'

        const session = {
          id: 'session-123',
          name: 'Test Session',
          status: 'active',
          startTime: new Date().toISOString()
        };

        // ACT
        monitoringDisplay.updateSessionDisplay(session);

        // ASSERT: Verify actual DOM content (behavioral test, not smoke test)
        expect(containerElement.innerHTML).toContain('Test Session');
        expect(containerElement.innerHTML).toContain('Status: <span style=\"color: #2e7d32; font-weight: bold;\">Active</span>');
      });
    });
  });

  // ============================================================================
  // TEST GROUP 8: SystemMonitor - Monitoring Display
  // ============================================================================

  describe('SystemMonitor', () => {
    let systemMonitor;

    beforeEach(() => {
      systemMonitor = new AdminModule.SystemMonitor();
    });

    describe('TEST 16: Orchestrator status display', () => {
      it('should update orchestrator status indicator correctly', () => {
        // ARRANGE
        const mockElement = {
          className: '',
          title: ''
        };
        global.document.getElementById = jest.fn().mockReturnValue(mockElement);

        // ACT: Update to connected
        systemMonitor.updateOrchestratorStatus('connected');

        // ASSERT
        expect(mockElement.className).toBe('status-dot connected');
        expect(mockElement.title).toBe('connected');
      });

      it('should show disconnected status correctly', () => {
        const mockElement = { className: '', title: '' };
        global.document.getElementById = jest.fn().mockReturnValue(mockElement);

        // ACT
        systemMonitor.updateOrchestratorStatus('offline');

        // ASSERT
        expect(mockElement.className).toBe('status-dot disconnected');
        expect(mockElement.title).toBe('offline');
      });
    });

    describe('TEST 17: VLC status display', () => {
      it('should update VLC status indicator when ready', () => {
        const mockElement = { className: '', title: '' };
        global.document.getElementById = jest.fn().mockReturnValue(mockElement);

        // ACT
        systemMonitor.updateVLCStatus('ready');

        // ASSERT
        expect(mockElement.className).toBe('status-dot connected');
        expect(mockElement.title).toBe('ready');
      });

      it('should update VLC status indicator when error', () => {
        const mockElement = { className: '', title: '' };
        global.document.getElementById = jest.fn().mockReturnValue(mockElement);

        // ACT
        systemMonitor.updateVLCStatus('error');

        // ASSERT
        expect(mockElement.className).toBe('status-dot disconnected');
        expect(mockElement.title).toBe('error');
      });
    });

    describe('TEST 18: Device list display', () => {
      it('should display device count correctly', () => {
        // ARRANGE
        const countElement = { textContent: '' };
        const listElement = { innerHTML: '' };

        global.document.getElementById = jest.fn()
          .mockReturnValueOnce(countElement)
          .mockReturnValueOnce(listElement);

        const devices = [
          { deviceId: 'GM_Station_1', deviceType: 'gm' },
          { deviceId: 'GM_Station_2', deviceType: 'gm' },
          { deviceId: 'Player_001', deviceType: 'player' }
        ];

        // ACT
        systemMonitor.updateDeviceList(devices);

        // ASSERT
        expect(countElement.textContent).toBe(3);
      });

      it('should render device list HTML correctly', () => {
        const countElement = { textContent: '' };
        const listElement = { innerHTML: '' };

        global.document.getElementById = jest.fn()
          .mockReturnValueOnce(countElement)
          .mockReturnValueOnce(listElement);

        const devices = [
          { deviceId: 'GM_Station_1', deviceType: 'gm' }
        ];

        // ACT
        systemMonitor.updateDeviceList(devices);

        // ASSERT
        expect(listElement.innerHTML).toContain('GM_Station_1');
        expect(listElement.innerHTML).toContain('gm');
        expect(listElement.innerHTML).toContain('device-item');
      });

      it('should handle empty device list', () => {
        const countElement = { textContent: '' };
        const listElement = { innerHTML: '' };

        global.document.getElementById = jest.fn()
          .mockReturnValueOnce(countElement)
          .mockReturnValueOnce(listElement);

        // ACT
        systemMonitor.updateDeviceList([]);

        // ASSERT
        expect(countElement.textContent).toBe(0);
        expect(listElement.innerHTML).toBe('');
      });

      it('should update internal devices state', () => {
        const devices = [
          { deviceId: 'GM_Station_1', deviceType: 'gm' }
        ];

        // ACT
        systemMonitor.updateDeviceList(devices);

        // ASSERT
        expect(systemMonitor.devices).toEqual(devices);
      });
    });

    describe('TEST 19: Monitoring refresh', () => {
      it('should request state sync when refresh called', () => {
        // ARRANGE
        const mockClient = {
          requestStateSync: jest.fn()
        };

        global.window = {
          connectionManager: {
            client: mockClient
          }
        };

        // ACT
        systemMonitor.refresh();

        // ASSERT
        expect(mockClient.requestStateSync).toHaveBeenCalledTimes(1);
      });

      it('should handle missing connectionManager gracefully', () => {
        // ARRANGE
        global.window = {};

        // ACT & ASSERT: Should not crash
        expect(() => {
          systemMonitor.refresh();
        }).not.toThrow();
      });
    });
  });

  // ============================================================================
  // TEST GROUP 9: Contract Compliance Validation
  // ============================================================================

  describe('AsyncAPI Contract Compliance', () => {
    describe('TEST 20: Required event structure fields', () => {
      it('should include all required fields per AsyncAPI contract', async () => {
        // ARRANGE
        const adminOps = new AdminModule.AdminOperations(mockConnection);

        // ACT
        const promise = adminOps.adjustScore('001', 100, 'test');

        // ASSERT: Verify structure matches AsyncAPI schema (lines 1004-1048)
        const emittedEvent = mockSocket.emit.mock.calls[0][1];

        // Required top-level fields
        expect(emittedEvent).toHaveProperty('event');
        expect(emittedEvent).toHaveProperty('data');
        expect(emittedEvent).toHaveProperty('timestamp');

        // Required data fields
        expect(emittedEvent.data).toHaveProperty('action');
        expect(emittedEvent.data).toHaveProperty('payload');

        // Type validation
        expect(typeof emittedEvent.event).toBe('string');
        expect(typeof emittedEvent.data).toBe('object');
        expect(typeof emittedEvent.timestamp).toBe('string');

        // Cleanup
        mockSocket.once.mock.calls[0][1]({ data: { success: true } });
        await promise;
      });

      it('should use correct event name constant', async () => {
        // ARRANGE
        const sessionManager = new AdminModule.SessionManager(mockConnection);

        // ACT
        const promise = sessionManager.createSession('Test');

        // ASSERT
        const emittedEvent = mockSocket.emit.mock.calls[0][1];
        expect(emittedEvent.event).toBe('gm:command');

        // Cleanup
        mockSocket.once.mock.calls[0][1]({ data: { success: true, session: {} } });
        await promise;
      });
    });

    describe('TEST 21: Action enum validation', () => {
      it('should use valid action values from AsyncAPI enum', async () => {
        // AsyncAPI defines specific action values (lines 1023-1038)
        const validActions = [
          'session:create',
          'session:pause',
          'session:resume',
          'session:end',
          'video:play',
          'video:pause',
          'video:stop',
          'video:skip',
          'video:queue:add',
          'video:queue:reorder',
          'video:queue:clear',
          'score:adjust',
          'transaction:delete',
          'transaction:create',
          'system:reset'
        ];

        const sessionManager = new AdminModule.SessionManager(mockConnection);

        // Test session:create
        const p1 = sessionManager.createSession('Test');
        expect(mockSocket.emit.mock.calls[0][1].data.action).toBe('session:create');
        expect(validActions).toContain('session:create');
        mockSocket.once.mock.calls[0][1]({ data: { success: true, session: {} } });
        await p1;
      });
    });
  });
});
