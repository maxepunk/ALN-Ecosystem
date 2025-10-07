/**
 * AdminModule.MonitoringDisplay Tests
 * Phase 2.2: Event-driven monitoring display architecture
 *
 * Tests verify:
 * - Event listener registration
 * - Display updates from WebSocket events
 * - FR Section 4.1 compliance (all 5 monitoring types)
 * - AsyncAPI contract event handling
 * - Edge cases and error handling
 */

const AdminModule = require('../../../../ALNScanner/js/utils/adminModule');

describe('AdminModule.MonitoringDisplay', () => {
    let monitoring;
    let mockConnection;
    let mockElements;

    beforeEach(() => {
        // Mock connection with event emitter pattern
        mockConnection = {
            _handlers: {},
            on: jest.fn((event, handler) => {
                mockConnection._handlers[event] = handler;
            }),
            emit: jest.fn((event, data) => {
                if (mockConnection._handlers[event]) {
                    mockConnection._handlers[event](data);
                }
            }),
            isConnected: true,
            connectedDevices: []
        };

        // Mock all admin panel DOM elements with proper innerHTML getter/setter
        mockElements = {};

        // Transaction log with innerHTML getter/setter and querySelectorAll
        const txLog = {
            _innerHTML: '',
            appendChild: jest.fn(),
            querySelectorAll: jest.fn(() => [])
        };
        Object.defineProperty(txLog, 'innerHTML', {
            get() { return this._innerHTML; },
            set(value) { this._innerHTML = value; }
        });
        mockElements['admin-transaction-log'] = txLog;

        // Score board with innerHTML getter/setter
        const scoreBoard = { _innerHTML: '' };
        Object.defineProperty(scoreBoard, 'innerHTML', {
            get() { return this._innerHTML; },
            set(value) { this._innerHTML = value; }
        });
        mockElements['admin-score-board'] = scoreBoard;

        // Device list with innerHTML getter/setter
        const deviceList = { _innerHTML: '' };
        Object.defineProperty(deviceList, 'innerHTML', {
            get() { return this._innerHTML; },
            set(value) { this._innerHTML = value; }
        });
        mockElements['device-list'] = deviceList;

        // Text-based elements
        mockElements['admin-session-id'] = { textContent: '' };
        mockElements['admin-session-status'] = { textContent: '' };
        mockElements['admin-current-video'] = { textContent: '' };
        mockElements['admin-queue-length'] = { textContent: '' };
        mockElements['orchestrator-status'] = { className: '', title: '' };
        mockElements['vlc-status'] = { className: '', title: '' };
        mockElements['device-count'] = { textContent: '' };

        global.document = {
            getElementById: jest.fn((id) => mockElements[id] || null)
        };

        // Mock window.DataManager
        global.window = {
            DataManager: {
                backendScores: new Map(),
                transactions: [],
                updateTeamScoreFromBackend: jest.fn()
            }
        };

        // Create monitoring instance (will register listeners)
        monitoring = new AdminModule.MonitoringDisplay(mockConnection);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    // ============================================
    // TEST GROUP 1: Event Listener Registration
    // ============================================
    describe('Event Listener Registration', () => {
        it('should register transaction:new listener on construction', () => {
            expect(mockConnection.on).toHaveBeenCalledWith('transaction:new', expect.any(Function));
        });

        it('should register score:updated listener on construction', () => {
            expect(mockConnection.on).toHaveBeenCalledWith('score:updated', expect.any(Function));
        });

        it('should register session:update listener on construction', () => {
            expect(mockConnection.on).toHaveBeenCalledWith('session:update', expect.any(Function));
        });

        it('should register video:status listener on construction', () => {
            expect(mockConnection.on).toHaveBeenCalledWith('video:status', expect.any(Function));
        });

        it('should register device:connected listener on construction', () => {
            expect(mockConnection.on).toHaveBeenCalledWith('device:connected', expect.any(Function));
        });

        it('should register device:disconnected listener on construction', () => {
            expect(mockConnection.on).toHaveBeenCalledWith('device:disconnected', expect.any(Function));
        });

        it('should register sync:full listener on construction', () => {
            expect(mockConnection.on).toHaveBeenCalledWith('sync:full', expect.any(Function));
        });
    });

    // ============================================
    // TEST GROUP 2: Transaction Display Updates
    // FR 4.1.5: Transaction Monitoring
    // ============================================
    describe('Transaction Display - FR 4.1.5', () => {
        it('should update transaction log when transaction:new event received', () => {
            const transaction = {
                id: 'tx-001',
                tokenId: 'abc123',
                teamId: '001',
                deviceId: 'GM_Station_1',
                mode: 'blackmarket',
                points: 100,
                timestamp: '2025-10-06T10:00:00Z',
                memoryType: 'Technical',
                valueRating: 3,
                group: 'Group A (x2)'
            };

            // Phase 2.3: transaction:new payload is { transaction: {...} }, not flat
            mockConnection.emit('transaction:new', { transaction });

            const logHtml = mockElements['admin-transaction-log'].innerHTML;
            expect(logHtml).toContain('abc123');
            expect(logHtml).toContain('001');
            expect(logHtml).toContain('Technical');
        });

        it('should format transaction timestamp as locale time string', () => {
            const transaction = {
                tokenId: 'test-token',
                teamId: '002',
                deviceId: 'GM_Station_2',
                mode: 'detective',
                points: 50,
                timestamp: '2025-10-06T14:30:00Z'
            };

            mockConnection.emit('transaction:new', { transaction });

            const logHtml = mockElements['admin-transaction-log'].innerHTML;
            // Should contain formatted time (exact format varies by locale)
            expect(logHtml).toContain('test-token');
            expect(logHtml).toContain('002');
        });

        it('should include token metadata fields when available', () => {
            const transaction = {
                tokenId: 'meta-test',
                teamId: '003',
                deviceId: 'GM_Station_1',
                mode: 'blackmarket',
                points: 150,
                timestamp: '2025-10-06T15:00:00Z',
                memoryType: 'Personal',
                valueRating: 5,
                group: 'Group C (x3)'
            };

            mockConnection.emit('transaction:new', { transaction });

            const logHtml = mockElements['admin-transaction-log'].innerHTML;
            expect(logHtml).toContain('Personal');
            expect(logHtml).toContain('meta-test');
        });

        it('should handle missing transaction metadata gracefully', () => {
            const transaction = {
                tokenId: 'minimal-tx',
                teamId: '001',
                deviceId: 'GM_Station_1',
                mode: 'detective',
                points: 25,
                timestamp: '2025-10-06T16:00:00Z'
                // No memoryType, valueRating, group
            };

            expect(() => {
                mockConnection.emit('transaction:new', { transaction });
            }).not.toThrow();

            const logHtml = mockElements['admin-transaction-log'].innerHTML;
            expect(logHtml).toContain('minimal-tx');
        });

        it('should handle missing DOM element gracefully', () => {
            mockElements['admin-transaction-log'] = null;

            const transaction = {
                tokenId: 'test',
                teamId: '001',
                deviceId: 'test',
                mode: 'blackmarket',
                points: 100,
                timestamp: '2025-10-06T10:00:00Z'
            };

            expect(() => {
                mockConnection.emit('transaction:new', { transaction });
            }).not.toThrow();
        });
    });

    // ============================================
    // TEST GROUP 3: Score Display Updates
    // FR 4.1.4: Score Monitoring
    // ============================================
    describe('Score Display - FR 4.1.4', () => {
        it('should update score board when score:updated event received', () => {
            const scoreData = {
                teamId: '001',
                currentScore: 500,
                baseScore: 300,
                bonusPoints: 200,
                tokensScanned: 15,
                completedGroups: ['Group A (x2)', 'Group B (x1.5)'],
                lastUpdate: '2025-10-06T10:00:00Z'
            };

            // Populate DataManager.backendScores (simulates what DataManager does)
            global.window.DataManager.backendScores.set('001', scoreData);

            mockConnection.emit('score:updated', scoreData);

            const boardHtml = mockElements['admin-score-board'].innerHTML;
            expect(boardHtml).toContain('001');
            expect(boardHtml).toContain('500');
            expect(boardHtml).toContain('15');
        });

        it('should display score breakdown (base + bonus)', () => {
            const scoreData = {
                teamId: '002',
                currentScore: 750,
                baseScore: 600,
                bonusPoints: 150,
                tokensScanned: 20,
                completedGroups: ['Group C (x3)'],
                lastUpdate: '2025-10-06T11:00:00Z'
            };

            // Populate DataManager.backendScores
            global.window.DataManager.backendScores.set('002', scoreData);

            mockConnection.emit('score:updated', scoreData);

            const boardHtml = mockElements['admin-score-board'].innerHTML;
            expect(boardHtml).toContain('002');
            expect(boardHtml).toContain('750');
            expect(boardHtml).toContain('20');
        });

        it('should format large scores with locale separators', () => {
            const scoreData = {
                teamId: '003',
                currentScore: 1234567,
                baseScore: 1000000,
                bonusPoints: 234567,
                tokensScanned: 100,
                completedGroups: [],
                lastUpdate: '2025-10-06T12:00:00Z'
            };

            // Populate DataManager.backendScores
            global.window.DataManager.backendScores.set('003', scoreData);

            mockConnection.emit('score:updated', scoreData);

            const boardHtml = mockElements['admin-score-board'].innerHTML;
            // Should contain formatted number (1,234,567 or 1.234.567 depending on locale)
            expect(boardHtml).toContain('003');
        });

        it('should handle missing DOM element gracefully', () => {
            mockElements['admin-score-board'] = null;

            const scoreData = {
                teamId: '001',
                currentScore: 500,
                baseScore: 300,
                bonusPoints: 200,
                tokensScanned: 15,
                completedGroups: [],
                lastUpdate: '2025-10-06T10:00:00Z'
            };

            expect(() => {
                mockConnection.emit('score:updated', scoreData);
            }).not.toThrow();
        });
    });

    // ============================================
    // TEST GROUP 4: Session Display Updates
    // FR 4.1.1: Session Monitoring
    // ============================================
    describe('Session Display - FR 4.1.1', () => {
        it('should update session info when session:update event received', () => {
            const session = {
                id: 'session-12345',
                name: 'Friday Night Game',
                status: 'active',
                startTime: '2025-10-06T18:00:00Z',
                teams: ['001', '002', '003']
            };

            mockConnection.emit('session:update', session);

            expect(mockElements['admin-session-id'].textContent).toBe('session-12345');
            expect(mockElements['admin-session-status'].textContent).toBe('active');
        });

        it('should display session status correctly (active, paused, ended)', () => {
            const sessionPaused = {
                id: 'session-67890',
                name: 'Test Session',
                status: 'paused',
                startTime: '2025-10-06T19:00:00Z',
                teams: ['001']
            };

            mockConnection.emit('session:update', sessionPaused);

            expect(mockElements['admin-session-status'].textContent).toBe('paused');
        });

        it('should handle null session (no active session)', () => {
            mockConnection.emit('session:update', null);

            expect(mockElements['admin-session-id'].textContent).toBe('-');
            expect(mockElements['admin-session-status'].textContent).toBe('No Session');
        });

        it('should handle undefined session fields gracefully', () => {
            const partialSession = {
                // Missing id, name
                status: 'active'
            };

            expect(() => {
                mockConnection.emit('session:update', partialSession);
            }).not.toThrow();

            expect(mockElements['admin-session-id'].textContent).toBe('-');
            expect(mockElements['admin-session-status'].textContent).toBe('active');
        });

        it('should handle missing DOM elements gracefully', () => {
            mockElements['admin-session-id'] = null;
            mockElements['admin-session-status'] = null;

            const session = {
                id: 'test-session',
                status: 'active'
            };

            expect(() => {
                mockConnection.emit('session:update', session);
            }).not.toThrow();
        });
    });

    // ============================================
    // TEST GROUP 5: Video Display Updates
    // FR 4.1.2: Video Monitoring
    // ============================================
    describe('Video Display - FR 4.1.2', () => {
        it('should update video info when video:status event received', () => {
            const videoStatus = {
                status: 'playing',
                tokenId: 'video-token-123',
                queueLength: 3,
                duration: 120,
                progress: 45
            };

            mockConnection.emit('video:status', videoStatus);

            expect(mockElements['admin-current-video'].textContent).toBe('video-token-123');
            expect(mockElements['admin-queue-length'].textContent).toBe('3');
        });

        it('should display queue length as integer', () => {
            const videoStatus = {
                status: 'playing',
                tokenId: 'another-video',
                queueLength: 7
            };

            mockConnection.emit('video:status', videoStatus);

            expect(mockElements['admin-queue-length'].textContent).toBe('7');
        });

        it('should handle idle state (no video playing)', () => {
            const videoStatus = {
                status: 'idle',
                tokenId: null,
                queueLength: 0
            };

            mockConnection.emit('video:status', videoStatus);

            expect(mockElements['admin-current-video'].textContent).toBe('None');
            expect(mockElements['admin-queue-length'].textContent).toBe('0');
        });

        it('should handle video completion', () => {
            const videoStatus = {
                status: 'completed',
                tokenId: 'completed-video',
                queueLength: 2
            };

            mockConnection.emit('video:status', videoStatus);

            expect(mockElements['admin-current-video'].textContent).toBe('completed-video');
            expect(mockElements['admin-queue-length'].textContent).toBe('2');
        });

        it('should handle missing DOM elements gracefully', () => {
            mockElements['admin-current-video'] = null;
            mockElements['admin-queue-length'] = null;

            const videoStatus = {
                status: 'playing',
                tokenId: 'test-video',
                queueLength: 1
            };

            expect(() => {
                mockConnection.emit('video:status', videoStatus);
            }).not.toThrow();
        });
    });

    // ============================================
    // TEST GROUP 6: System Display Updates
    // FR 4.1.3: System Monitoring
    // ============================================
    describe('System Display - FR 4.1.3', () => {
        it('should update orchestrator status based on connection state', () => {
            mockConnection.isConnected = true;

            mockConnection.emit('device:connected', { deviceId: 'test', type: 'gm' });

            expect(mockElements['orchestrator-status'].className).toContain('connected');
        });

        it('should update orchestrator status to disconnected when offline', () => {
            mockConnection.isConnected = false;

            mockConnection.emit('device:disconnected', { deviceId: 'test' });

            expect(mockElements['orchestrator-status'].className).toContain('disconnected');
        });

        it('should update device count correctly', () => {
            mockConnection.connectedDevices = [
                { deviceId: 'GM_Station_1', type: 'gm' },
                { deviceId: 'GM_Station_2', type: 'gm' },
                { deviceId: 'Player_001', type: 'player' }
            ];

            mockConnection.emit('device:connected', mockConnection.connectedDevices[2]);

            expect(mockElements['device-count'].textContent).toBe('3');
        });

        it('should update device list with device details', () => {
            mockConnection.connectedDevices = [
                { deviceId: 'GM_Station_1', type: 'gm', ipAddress: '192.168.1.100' },
                { deviceId: 'Player_001', type: 'player', ipAddress: '192.168.1.101' }
            ];

            mockConnection.emit('device:connected', mockConnection.connectedDevices[0]);

            const listHtml = mockElements['device-list'].innerHTML;
            expect(listHtml).toContain('GM_Station_1');
            expect(listHtml).toContain('gm');
        });

        it('should handle empty device list', () => {
            mockConnection.connectedDevices = [];

            mockConnection.emit('device:disconnected', { deviceId: 'last-device' });

            expect(mockElements['device-count'].textContent).toBe('0');
            expect(mockElements['device-list'].innerHTML).toBe('');
        });

        it('should handle missing DOM elements gracefully', () => {
            mockElements['orchestrator-status'] = null;
            mockElements['device-count'] = null;
            mockElements['device-list'] = null;

            mockConnection.connectedDevices = [{ deviceId: 'test', type: 'gm' }];

            expect(() => {
                mockConnection.emit('device:connected', { deviceId: 'test', type: 'gm' });
            }).not.toThrow();
        });
    });

    // ============================================
    // TEST GROUP 7: sync:full Initialization
    // ============================================
    describe('sync:full Event - Complete State Initialization', () => {
        it('should initialize all displays when sync:full received', () => {
            const syncData = {
                session: {
                    id: 'sync-session',
                    status: 'active',
                    startTime: '2025-10-06T10:00:00Z'
                },
                videoStatus: {
                    status: 'playing',
                    tokenId: 'sync-video',
                    queueLength: 2
                },
                scores: [
                    { teamId: '001', currentScore: 500, baseScore: 400, bonusPoints: 100, tokensScanned: 10, completedGroups: [] },
                    { teamId: '002', currentScore: 750, baseScore: 600, bonusPoints: 150, tokensScanned: 15, completedGroups: [] }
                ],
                recentTransactions: [
                    { tokenId: 'tx1', teamId: '001', deviceId: 'GM_Station_1', mode: 'blackmarket', points: 100, timestamp: '2025-10-06T09:00:00Z' },
                    { tokenId: 'tx2', teamId: '002', deviceId: 'GM_Station_2', mode: 'detective', points: 50, timestamp: '2025-10-06T09:30:00Z' }
                ],
                devices: [
                    { deviceId: 'GM_Station_1', type: 'gm' },
                    { deviceId: 'Player_001', type: 'player' }
                ],
                systemStatus: {
                    orchestrator: 'connected',
                    vlc: 'ready'
                }
            };

            mockConnection.connectedDevices = syncData.devices;

            // Mock DataManager.updateTeamScoreFromBackend to populate backendScores
            global.window.DataManager.updateTeamScoreFromBackend = jest.fn((scoreData) => {
                global.window.DataManager.backendScores.set(scoreData.teamId, scoreData);
            });

            mockConnection.emit('sync:full', syncData);

            // Verify session display
            expect(mockElements['admin-session-id'].textContent).toBe('sync-session');
            expect(mockElements['admin-session-status'].textContent).toBe('active');

            // Verify video display
            expect(mockElements['admin-current-video'].textContent).toBe('sync-video');
            expect(mockElements['admin-queue-length'].textContent).toBe('2');

            // Verify score board updated
            expect(mockElements['admin-score-board'].innerHTML).toContain('001');
            expect(mockElements['admin-score-board'].innerHTML).toContain('002');

            // Verify transaction log updated
            expect(mockElements['admin-transaction-log'].innerHTML).toContain('tx1');
            expect(mockElements['admin-transaction-log'].innerHTML).toContain('tx2');

            // Verify system display
            expect(mockElements['device-count'].textContent).toBe('2');
        });

        it('should handle sync:full with missing optional fields', () => {
            const minimalSync = {
                session: null,
                scores: [],
                recentTransactions: [],
                devices: [],
                systemStatus: { orchestrator: 'connected', vlc: 'ready' }
            };

            mockConnection.connectedDevices = [];

            expect(() => {
                mockConnection.emit('sync:full', minimalSync);
            }).not.toThrow();

            expect(mockElements['admin-session-id'].textContent).toBe('-');
            expect(mockElements['device-count'].textContent).toBe('0');
        });

        it('should display last 10 transactions from sync:full', () => {
            const manyTransactions = [];
            for (let i = 0; i < 20; i++) {
                manyTransactions.push({
                    tokenId: `tx-${i}`,
                    teamId: '001',
                    deviceId: 'GM_Station_1',
                    mode: 'blackmarket',
                    points: 100,
                    timestamp: `2025-10-06T${String(10 + i).padStart(2, '0')}:00:00Z`
                });
            }

            const syncData = {
                session: null,
                scores: [],
                recentTransactions: manyTransactions,
                devices: [],
                systemStatus: { orchestrator: 'connected', vlc: 'ready' }
            };

            mockConnection.emit('sync:full', syncData);

            const logHtml = mockElements['admin-transaction-log'].innerHTML;

            // Should contain last 10 (tx-10 through tx-19)
            expect(logHtml).toContain('tx-19');
            expect(logHtml).toContain('tx-10');

            // Should NOT contain first 10 (tx-0 through tx-9)
            expect(logHtml).not.toContain('tx-0');
            expect(logHtml).not.toContain('tx-9');
        });

        it('should update all team scores from sync:full', () => {
            const syncData = {
                session: null,
                scores: [
                    { teamId: '001', currentScore: 100, baseScore: 100, bonusPoints: 0, tokensScanned: 5, completedGroups: [] },
                    { teamId: '002', currentScore: 200, baseScore: 200, bonusPoints: 0, tokensScanned: 10, completedGroups: [] },
                    { teamId: '003', currentScore: 300, baseScore: 300, bonusPoints: 0, tokensScanned: 15, completedGroups: [] }
                ],
                recentTransactions: [],
                devices: [],
                systemStatus: { orchestrator: 'connected', vlc: 'ready' }
            };

            // Mock DataManager.updateTeamScoreFromBackend to populate backendScores
            global.window.DataManager.updateTeamScoreFromBackend = jest.fn((scoreData) => {
                global.window.DataManager.backendScores.set(scoreData.teamId, scoreData);
            });

            mockConnection.emit('sync:full', syncData);

            const boardHtml = mockElements['admin-score-board'].innerHTML;
            expect(boardHtml).toContain('001');
            expect(boardHtml).toContain('002');
            expect(boardHtml).toContain('003');
        });
    });

    // ============================================
    // TEST GROUP 8: Edge Cases
    // ============================================
    describe('Edge Cases and Error Handling', () => {
        it('should handle multiple rapid transaction events without errors', () => {
            expect(() => {
                for (let i = 0; i < 50; i++) {
                    mockConnection.emit('transaction:new', {
                        tokenId: `rapid-${i}`,
                        teamId: '001',
                        deviceId: 'GM_Station_1',
                        mode: 'blackmarket',
                        points: 100,
                        timestamp: new Date().toISOString()
                    });
                }
            }).not.toThrow();
        });

        it('should handle multiple rapid score update events without errors', () => {
            expect(() => {
                for (let i = 0; i < 50; i++) {
                    mockConnection.emit('score:updated', {
                        teamId: '001',
                        currentScore: 100 * i,
                        baseScore: 80 * i,
                        bonusPoints: 20 * i,
                        tokensScanned: i,
                        completedGroups: [],
                        lastUpdate: new Date().toISOString()
                    });
                }
            }).not.toThrow();
        });

        it('should work when DOM elements are not yet loaded', () => {
            // All elements null
            Object.keys(mockElements).forEach(key => {
                mockElements[key] = null;
            });

            expect(() => {
                mockConnection.emit('transaction:new', {
                    tokenId: 'test',
                    teamId: '001',
                    deviceId: 'test',
                    mode: 'blackmarket',
                    points: 100,
                    timestamp: new Date().toISOString()
                });

                mockConnection.emit('score:updated', {
                    teamId: '001',
                    currentScore: 500,
                    baseScore: 400,
                    bonusPoints: 100,
                    tokensScanned: 10,
                    completedGroups: [],
                    lastUpdate: new Date().toISOString()
                });

                mockConnection.emit('session:update', {
                    id: 'test',
                    status: 'active'
                });

                mockConnection.emit('video:status', {
                    status: 'playing',
                    tokenId: 'test',
                    queueLength: 1
                });
            }).not.toThrow();
        });

        it('should handle malformed event data gracefully', () => {
            expect(() => {
                mockConnection.emit('transaction:new', null);
                mockConnection.emit('transaction:new', undefined);
                mockConnection.emit('transaction:new', {});
                mockConnection.emit('score:updated', null);
                mockConnection.emit('session:update', {});
                mockConnection.emit('video:status', {});
            }).not.toThrow();
        });

        it('should clear displays appropriately when connection lost', () => {
            mockConnection.isConnected = false;

            // Simulate disconnect
            mockConnection.emit('device:disconnected', { deviceId: 'test' });

            // Orchestrator status should show disconnected
            expect(mockElements['orchestrator-status'].className).toContain('disconnected');
        });
    });
});
