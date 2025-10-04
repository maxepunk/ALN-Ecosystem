/**
 * StandaloneDataManager Unit Tests (Scanner)
 * Tests standalone mode local data management
 */

// Mock localStorage
const localStorageMock = (() => {
    let store = {};
    return {
        getItem: jest.fn((key) => store[key] || null),
        setItem: jest.fn((key, value) => {
            store[key] = value.toString();
        }),
        removeItem: jest.fn((key) => {
            delete store[key];
        }),
        clear: jest.fn(() => {
            store = {};
        })
    };
})();

global.localStorage = localStorageMock;

// Mock window.UIManager
global.window = {
    UIManager: {
        updateScoreboard: jest.fn()
    }
};

// Mock console
global.console = {
    log: jest.fn(),
    error: jest.fn()
};

// Mock URL and Blob for export tests
global.URL = {
    createObjectURL: jest.fn(() => 'blob:mock-url'),
    revokeObjectURL: jest.fn()
};

global.Blob = jest.fn(function(content, options) {
    this.content = content;
    this.options = options;
});

// Mock document for export
global.document = {
    createElement: jest.fn(() => ({
        href: '',
        download: '',
        click: jest.fn()
    }))
};

// Mock confirm
global.confirm = jest.fn(() => false);

// Load StandaloneDataManager
const StandaloneDataManager = require('../../../../ALNScanner/js/core/standaloneDataManager');

describe('StandaloneDataManager - Business Logic (Layer 1 Unit Tests)', () => {
    let manager;

    beforeEach(() => {
        // Clear localStorage mock
        localStorageMock.clear();
        jest.clearAllMocks();

        // Create new instance
        manager = new StandaloneDataManager();
    });

    describe('Session Initialization', () => {
        it('should initialize with new session data', () => {
            expect(manager.sessionData).toBeDefined();
            expect(manager.sessionData.sessionId).toMatch(/^LOCAL_/);
            expect(manager.sessionData.startTime).toBeDefined();
            expect(manager.sessionData.transactions).toEqual([]);
            expect(manager.sessionData.teams).toEqual({});
            expect(manager.sessionData.mode).toBe('standalone');
        });

        it('should generate unique session IDs', () => {
            const id1 = manager.generateLocalSessionId();
            const id2 = manager.generateLocalSessionId();

            expect(id1).toMatch(/^LOCAL_\d+_[a-z0-9]+$/);
            expect(id2).toMatch(/^LOCAL_\d+_[a-z0-9]+$/);
            expect(id1).not.toBe(id2);
        });

        it('should have session ID starting with LOCAL_', () => {
            expect(manager.sessionData.sessionId).toMatch(/^LOCAL_/);
        });

        it('should have ISO timestamp for startTime', () => {
            expect(manager.sessionData.startTime).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        });
    });

    describe('Transaction Management', () => {
        it('should add transaction to session', () => {
            const transaction = {
                id: 'tx-001',
                tokenId: 'token123',
                teamId: '001',
                stationMode: 'blackmarket',
                points: 100,
                timestamp: new Date().toISOString()
            };

            manager.addTransaction(transaction);

            expect(manager.sessionData.transactions).toContainEqual(transaction);
            expect(manager.sessionData.transactions.length).toBe(1);
        });

        it('should save session after adding transaction', () => {
            const transaction = {
                id: 'tx-001',
                tokenId: 'token123',
                teamId: '001',
                stationMode: 'blackmarket',
                points: 100,
                timestamp: new Date().toISOString()
            };

            manager.addTransaction(transaction);

            expect(localStorageMock.setItem).toHaveBeenCalledWith(
                'standaloneSession',
                expect.any(String)
            );
        });

        it('should update local scores when adding transaction', () => {
            const transaction = {
                id: 'tx-001',
                tokenId: 'token123',
                teamId: '001',
                stationMode: 'blackmarket',
                points: 100,
                timestamp: new Date().toISOString()
            };

            manager.addTransaction(transaction);

            expect(manager.sessionData.teams['001']).toBeDefined();
            expect(manager.sessionData.teams['001'].score).toBe(100);
        });
    });

    describe('Local Score Updates', () => {
        it('should create team entry on first transaction', () => {
            const transaction = {
                teamId: '001',
                stationMode: 'blackmarket',
                points: 100,
                timestamp: new Date().toISOString()
            };

            manager.updateLocalScores(transaction);

            expect(manager.sessionData.teams['001']).toEqual({
                teamId: '001',
                score: 100,
                tokensScanned: 1,
                lastScanTime: transaction.timestamp
            });
        });

        it('should add points for blackmarket mode', () => {
            const tx1 = {
                teamId: '001',
                stationMode: 'blackmarket',
                points: 100,
                timestamp: new Date().toISOString()
            };

            const tx2 = {
                teamId: '001',
                stationMode: 'blackmarket',
                points: 200,
                timestamp: new Date().toISOString()
            };

            manager.updateLocalScores(tx1);
            manager.updateLocalScores(tx2);

            expect(manager.sessionData.teams['001'].score).toBe(300);
            expect(manager.sessionData.teams['001'].tokensScanned).toBe(2);
        });

        it('should not add points for detective mode', () => {
            const transaction = {
                teamId: '001',
                stationMode: 'detective',
                points: 100,
                timestamp: new Date().toISOString()
            };

            manager.updateLocalScores(transaction);

            expect(manager.sessionData.teams['001'].score).toBe(0);
            expect(manager.sessionData.teams['001'].tokensScanned).toBe(1);
        });

        it('should track tokens scanned regardless of mode', () => {
            const tx1 = {
                teamId: '001',
                stationMode: 'detective',
                points: 0,
                timestamp: new Date().toISOString()
            };

            const tx2 = {
                teamId: '001',
                stationMode: 'blackmarket',
                points: 100,
                timestamp: new Date().toISOString()
            };

            manager.updateLocalScores(tx1);
            manager.updateLocalScores(tx2);

            expect(manager.sessionData.teams['001'].tokensScanned).toBe(2);
        });

        it('should update lastScanTime', () => {
            const timestamp1 = '2025-10-03T12:00:00.000Z';
            const timestamp2 = '2025-10-03T12:30:00.000Z';

            manager.updateLocalScores({
                teamId: '001',
                stationMode: 'blackmarket',
                points: 100,
                timestamp: timestamp1
            });

            manager.updateLocalScores({
                teamId: '001',
                stationMode: 'blackmarket',
                points: 50,
                timestamp: timestamp2
            });

            expect(manager.sessionData.teams['001'].lastScanTime).toBe(timestamp2);
        });

        it('should handle multiple teams independently', () => {
            manager.updateLocalScores({
                teamId: '001',
                stationMode: 'blackmarket',
                points: 100,
                timestamp: new Date().toISOString()
            });

            manager.updateLocalScores({
                teamId: '002',
                stationMode: 'blackmarket',
                points: 200,
                timestamp: new Date().toISOString()
            });

            expect(manager.sessionData.teams['001'].score).toBe(100);
            expect(manager.sessionData.teams['002'].score).toBe(200);
            expect(Object.keys(manager.sessionData.teams).length).toBe(2);
        });
    });

    describe('Team Scores Retrieval', () => {
        beforeEach(() => {
            // Setup multiple teams
            manager.sessionData.teams = {
                '001': { teamId: '001', score: 300, tokensScanned: 3, lastScanTime: null },
                '002': { teamId: '002', score: 500, tokensScanned: 5, lastScanTime: null },
                '003': { teamId: '003', score: 100, tokensScanned: 1, lastScanTime: null }
            };
        });

        it('should return sorted team scores (highest first)', () => {
            const scores = manager.getTeamScores();

            expect(scores.length).toBe(3);
            expect(scores[0].teamId).toBe('002'); // 500 points
            expect(scores[1].teamId).toBe('001'); // 300 points
            expect(scores[2].teamId).toBe('003'); // 100 points
        });

        it('should return empty array when no teams', () => {
            manager.sessionData.teams = {};

            const scores = manager.getTeamScores();

            expect(scores).toEqual([]);
        });

        it('should preserve all team properties', () => {
            const scores = manager.getTeamScores();

            expect(scores[0]).toHaveProperty('teamId');
            expect(scores[0]).toHaveProperty('score');
            expect(scores[0]).toHaveProperty('tokensScanned');
            expect(scores[0]).toHaveProperty('lastScanTime');
        });
    });

    describe('Local Session Persistence', () => {
        it('should save session to localStorage', () => {
            manager.saveLocalSession();

            expect(localStorageMock.setItem).toHaveBeenCalledWith(
                'standaloneSession',
                expect.any(String)
            );
        });

        it('should save session as JSON', () => {
            manager.saveLocalSession();

            const savedData = localStorageMock.setItem.mock.calls[0][1];
            const parsed = JSON.parse(savedData);

            expect(parsed.sessionId).toBe(manager.sessionData.sessionId);
            expect(parsed.mode).toBe('standalone');
        });

        it('should load session from localStorage if from today', () => {
            // Clear and set up mock before creating manager
            localStorageMock.clear();

            const todaySession = {
                sessionId: 'LOCAL_123',
                startTime: new Date().toISOString(),
                transactions: [{ id: 'tx-001' }],
                teams: { '001': { score: 100 } },
                mode: 'standalone'
            };

            // Pre-populate localStorage before constructor runs
            localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(todaySession));

            const newManager = new StandaloneDataManager();

            expect(newManager.sessionData.sessionId).toBe('LOCAL_123');
            expect(newManager.sessionData.transactions.length).toBe(1);
        });

        it('should not load session from previous day', () => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);

            const oldSession = {
                sessionId: 'LOCAL_OLD',
                startTime: yesterday.toISOString(),
                transactions: [{ id: 'tx-001' }],
                teams: { '001': { score: 100 } },
                mode: 'standalone'
            };

            localStorageMock.setItem('standaloneSession', JSON.stringify(oldSession));

            const newManager = new StandaloneDataManager();

            expect(newManager.sessionData.sessionId).not.toBe('LOCAL_OLD');
            expect(newManager.sessionData.transactions.length).toBe(0);
        });

        it('should handle corrupted localStorage gracefully', () => {
            localStorageMock.setItem('standaloneSession', 'invalid json{{{');

            const newManager = new StandaloneDataManager();

            expect(newManager.sessionData).toBeDefined();
            expect(newManager.sessionData.sessionId).toMatch(/^LOCAL_/);
        });
    });

    describe('Session Export', () => {
        beforeEach(() => {
            // Setup mock anchor for all export tests
            const mockAnchor = {
                href: '',
                download: '',
                click: jest.fn()
            };
            global.document.createElement.mockReturnValue(mockAnchor);
        });

        it('should create blob with session data', () => {
            manager.exportSession();

            expect(global.Blob).toHaveBeenCalledWith(
                [expect.stringContaining(manager.sessionData.sessionId)],
                { type: 'application/json' }
            );
        });

        it('should trigger download', () => {
            manager.exportSession();

            const mockAnchor = global.document.createElement.mock.results[0].value;
            expect(mockAnchor.click).toHaveBeenCalled();
        });

        it('should include session ID in filename', () => {
            manager.exportSession();

            const mockAnchor = global.document.createElement.mock.results[0].value;
            expect(mockAnchor.download).toContain(manager.sessionData.sessionId);
            expect(mockAnchor.download).toMatch(/ALN_Session_.*\.json/);
        });
    });

    describe('Session Clearing', () => {
        beforeEach(() => {
            // Add some data
            manager.sessionData.transactions = [{ id: 'tx-001' }];
            manager.sessionData.teams = { '001': { score: 100 } };
        });

        it('should clear localStorage', () => {
            global.confirm.mockReturnValue(false);

            manager.clearSession();

            expect(localStorageMock.removeItem).toHaveBeenCalledWith('standaloneSession');
        });

        it('should reset session data', () => {
            global.confirm.mockReturnValue(false);

            const oldId = manager.sessionData.sessionId;
            manager.clearSession();

            expect(manager.sessionData.sessionId).not.toBe(oldId);
            expect(manager.sessionData.transactions).toEqual([]);
            expect(manager.sessionData.teams).toEqual({});
            expect(manager.sessionData.mode).toBe('standalone');
        });

        it('should export before clearing if confirmed', () => {
            global.confirm.mockReturnValue(true);
            // Setup mock for this specific test
            const mockAnchor = { href: '', download: '', click: jest.fn() };
            global.document.createElement.mockReturnValue(mockAnchor);

            manager.clearSession();

            expect(mockAnchor.click).toHaveBeenCalled();
        });

        it('should not export if not confirmed', () => {
            global.confirm.mockReturnValue(false);

            manager.clearSession();

            expect(global.Blob).not.toHaveBeenCalled();
        });
    });

    describe('Session Statistics', () => {
        it('should return session stats', () => {
            manager.sessionData.transactions = [
                { id: 'tx-001' },
                { id: 'tx-002' },
                { id: 'tx-003' }
            ];
            manager.sessionData.teams = {
                '001': { score: 100 },
                '002': { score: 200 }
            };

            const stats = manager.getSessionStats();

            expect(stats).toEqual({
                sessionId: manager.sessionData.sessionId,
                startTime: manager.sessionData.startTime,
                totalTransactions: 3,
                totalTeams: 2,
                mode: 'standalone'
            });
        });

        it('should return zero counts for empty session', () => {
            const stats = manager.getSessionStats();

            expect(stats.totalTransactions).toBe(0);
            expect(stats.totalTeams).toBe(0);
        });
    });
});
