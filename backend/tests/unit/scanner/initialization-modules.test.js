/**
 * Unit Tests: Module Initialization Functions
 * Tests for extracted module initialization functions
 *
 * Phase 1D-1I of initialization refactoring (remaining functions)
 */

const path = require('path');

// Mock Debug globally before any imports
global.Debug = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
};

describe('Module Initialization Functions', () => {
    let initSteps;

    beforeEach(() => {
        // Clear all mocks
        jest.clearAllMocks();

        // Import the functions we're testing
        try {
            initSteps = require('../../../../ALNScanner/js/app/initializationSteps');
        } catch (e) {
            console.error('Failed to load initializationSteps:', e.message);
            initSteps = null;
        }
    });

    describe('initializeUIManager', () => {
        it('should call UIManager.init()', () => {
            // ARRANGE
            const mockUIManager = {
                init: jest.fn()
            };

            // ACT
            initSteps.initializeUIManager(mockUIManager);

            // ASSERT
            expect(mockUIManager.init).toHaveBeenCalledTimes(1);
        });

        it('should not throw when UIManager.init() succeeds', () => {
            // ARRANGE
            const mockUIManager = {
                init: jest.fn()
            };

            // ACT & ASSERT
            expect(() => {
                initSteps.initializeUIManager(mockUIManager);
            }).not.toThrow();
        });
    });

    describe('createSessionModeManager', () => {
        it('should create SessionModeManager and attach to window', () => {
            // ARRANGE
            const mockWindow = {};
            const MockSessionModeManager = jest.fn();

            // ACT
            initSteps.createSessionModeManager(MockSessionModeManager, mockWindow);

            // ASSERT
            expect(MockSessionModeManager).toHaveBeenCalledTimes(1);
            expect(mockWindow.sessionModeManager).toBeInstanceOf(MockSessionModeManager);
        });

        it('should log creation', () => {
            // ARRANGE
            const mockWindow = {};
            const MockSessionModeManager = jest.fn();

            // ACT
            initSteps.createSessionModeManager(MockSessionModeManager, mockWindow);

            // ASSERT
            expect(global.Debug.log).toHaveBeenCalledWith('SessionModeManager initialized');
        });
    });

    describe('initializeViewController', () => {
        it('should call viewController.init()', () => {
            // ARRANGE
            const mockViewController = {
                init: jest.fn()
            };

            // ACT
            initSteps.initializeViewController(mockViewController);

            // ASSERT
            expect(mockViewController.init).toHaveBeenCalledTimes(1);
        });
    });

    describe('loadSettings', () => {
        it('should call Settings.load()', () => {
            // ARRANGE
            const mockSettings = {
                load: jest.fn()
            };

            // ACT
            initSteps.loadSettings(mockSettings);

            // ASSERT
            expect(mockSettings.load).toHaveBeenCalledTimes(1);
        });
    });

    describe('loadDataManager', () => {
        it('should load transactions, scanned tokens, and update badge', () => {
            // ARRANGE
            const mockDataManager = {
                loadTransactions: jest.fn(),
                loadScannedTokens: jest.fn()
            };
            const mockUIManager = {
                updateHistoryBadge: jest.fn()
            };

            // ACT
            initSteps.loadDataManager(mockDataManager, mockUIManager);

            // ASSERT
            expect(mockDataManager.loadTransactions).toHaveBeenCalledTimes(1);
            expect(mockDataManager.loadScannedTokens).toHaveBeenCalledTimes(1);
            expect(mockUIManager.updateHistoryBadge).toHaveBeenCalledTimes(1);
        });

        it('should call functions in correct order', () => {
            // ARRANGE
            const callOrder = [];
            const mockDataManager = {
                loadTransactions: jest.fn(() => callOrder.push('loadTransactions')),
                loadScannedTokens: jest.fn(() => callOrder.push('loadScannedTokens'))
            };
            const mockUIManager = {
                updateHistoryBadge: jest.fn(() => callOrder.push('updateHistoryBadge'))
            };

            // ACT
            initSteps.loadDataManager(mockDataManager, mockUIManager);

            // ASSERT
            expect(callOrder).toEqual(['loadTransactions', 'loadScannedTokens', 'updateHistoryBadge']);
        });
    });

    describe('detectNFCSupport', () => {
        it('should return true when NFC is supported', async () => {
            // ARRANGE
            const mockNFCHandler = {
                init: jest.fn().mockResolvedValue(true)
            };

            // ACT
            const result = await initSteps.detectNFCSupport(mockNFCHandler);

            // ASSERT
            expect(result).toBe(true);
            expect(mockNFCHandler.init).toHaveBeenCalledTimes(1);
        });

        it('should return false when NFC is not supported', async () => {
            // ARRANGE
            const mockNFCHandler = {
                init: jest.fn().mockResolvedValue(false)
            };

            // ACT
            const result = await initSteps.detectNFCSupport(mockNFCHandler);

            // ASSERT
            expect(result).toBe(false);
        });

        it('should log NFC support status', async () => {
            // ARRANGE
            const mockNFCHandler = {
                init: jest.fn().mockResolvedValue(true)
            };

            // ACT
            await initSteps.detectNFCSupport(mockNFCHandler);

            // ASSERT
            expect(global.Debug.log).toHaveBeenCalledWith('NFC support: true');
        });
    });

    describe('registerServiceWorker', () => {
        it('should register service worker when supported', async () => {
            // ARRANGE
            const mockRegistration = { scope: '/test-scope/' };
            const mockNavigator = {
                serviceWorker: {
                    register: jest.fn().mockResolvedValue(mockRegistration)
                }
            };
            const mockUIManager = {
                showError: jest.fn()
            };

            // ACT
            const result = await initSteps.registerServiceWorker(mockNavigator, mockUIManager);

            // ASSERT
            expect(result).toBe(true);
            expect(mockNavigator.serviceWorker.register).toHaveBeenCalledWith('./sw.js');
            expect(mockUIManager.showError).not.toHaveBeenCalled();
        });

        it('should return false when service worker not supported', async () => {
            // ARRANGE
            const mockNavigator = {}; // No serviceWorker property
            const mockUIManager = {
                showError: jest.fn()
            };

            // ACT
            const result = await initSteps.registerServiceWorker(mockNavigator, mockUIManager);

            // ASSERT
            expect(result).toBe(false);
            expect(mockUIManager.showError).not.toHaveBeenCalled();
        });

        it('should show error and return false when registration fails', async () => {
            // ARRANGE
            const error = new Error('Registration failed');
            const mockNavigator = {
                serviceWorker: {
                    register: jest.fn().mockRejectedValue(error)
                }
            };
            const mockUIManager = {
                showError: jest.fn()
            };

            // ACT
            const result = await initSteps.registerServiceWorker(mockNavigator, mockUIManager);

            // ASSERT
            expect(result).toBe(false);
            expect(mockUIManager.showError).toHaveBeenCalledWith(
                'Service Worker registration failed. Offline features may not work.'
            );
        });

        it('should log success when registration succeeds', async () => {
            // ARRANGE
            const mockRegistration = { scope: '/test-scope/' };
            const mockNavigator = {
                serviceWorker: {
                    register: jest.fn().mockResolvedValue(mockRegistration)
                }
            };
            const mockUIManager = { showError: jest.fn() };

            // ACT
            await initSteps.registerServiceWorker(mockNavigator, mockUIManager);

            // ASSERT
            expect(global.Debug.log).toHaveBeenCalledWith('Service Worker registered successfully');
        });

        it('should log failure when registration fails', async () => {
            // ARRANGE
            const error = new Error('Registration failed');
            const mockNavigator = {
                serviceWorker: {
                    register: jest.fn().mockRejectedValue(error)
                }
            };
            const mockUIManager = { showError: jest.fn() };

            // ACT
            await initSteps.registerServiceWorker(mockNavigator, mockUIManager);

            // ASSERT
            expect(global.Debug.log).toHaveBeenCalledWith('Service Worker registration failed');
        });
    });
});
