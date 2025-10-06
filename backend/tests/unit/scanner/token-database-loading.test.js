/**
 * Unit Tests: Token Database Loading
 * Tests for extracted loadTokenDatabase() function
 *
 * Phase 1A of initialization refactoring
 */

const path = require('path');

// Mock Debug globally before any imports
global.Debug = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
};

describe('Token Database Loading', () => {
    let loadTokenDatabase;
    let mockTokenManager;
    let mockUIManager;

    beforeEach(() => {
        // Clear all mocks
        jest.clearAllMocks();

        // Create fresh mocks for each test
        mockTokenManager = {
            loadDatabase: jest.fn()
        };

        mockUIManager = {
            showError: jest.fn()
        };

        // Import the function we're testing
        // Path is relative to backend/tests/unit/scanner/
        // Need to go up to backend, then into ALNScanner submodule
        try {
            const initSteps = require('../../../../ALNScanner/js/app/initializationSteps');
            loadTokenDatabase = initSteps.loadTokenDatabase;
        } catch (e) {
            // Function doesn't exist yet - expected for TDD
            console.error('Failed to load initializationSteps:', e.message);
            loadTokenDatabase = null;
        }
    });

    describe('TEST 1: Successful database load', () => {
        it('should return true when TokenManager.loadDatabase succeeds', async () => {
            // ARRANGE
            mockTokenManager.loadDatabase.mockResolvedValue(true);

            // ACT
            const result = await loadTokenDatabase(mockTokenManager, mockUIManager);

            // ASSERT
            expect(result).toBe(true);
            expect(mockTokenManager.loadDatabase).toHaveBeenCalledTimes(1);
            expect(global.Debug.log).toHaveBeenCalledWith('Token database loaded successfully');
            expect(mockUIManager.showError).not.toHaveBeenCalled();
        });

        it('should not throw when database loads successfully', async () => {
            // ARRANGE
            mockTokenManager.loadDatabase.mockResolvedValue(true);

            // ACT & ASSERT
            await expect(
                loadTokenDatabase(mockTokenManager, mockUIManager)
            ).resolves.not.toThrow();
        });
    });

    describe('TEST 2: Failed database load', () => {
        it('should throw error when TokenManager.loadDatabase fails', async () => {
            // ARRANGE
            mockTokenManager.loadDatabase.mockResolvedValue(false);

            // ACT & ASSERT
            await expect(
                loadTokenDatabase(mockTokenManager, mockUIManager)
            ).rejects.toThrow('Token database initialization failed');
        });

        it('should show user-facing error when database load fails', async () => {
            // ARRANGE
            mockTokenManager.loadDatabase.mockResolvedValue(false);

            // ACT
            try {
                await loadTokenDatabase(mockTokenManager, mockUIManager);
            } catch (e) {
                // Expected to throw
            }

            // ASSERT
            expect(mockUIManager.showError).toHaveBeenCalledTimes(1);
            expect(mockUIManager.showError).toHaveBeenCalledWith(
                'CRITICAL: Token database failed to load. Cannot initialize scanner.'
            );
        });

        it('should log error message when database load fails', async () => {
            // ARRANGE
            mockTokenManager.loadDatabase.mockResolvedValue(false);

            // ACT
            try {
                await loadTokenDatabase(mockTokenManager, mockUIManager);
            } catch (e) {
                // Expected to throw
            }

            // ASSERT
            expect(global.Debug.error).toHaveBeenCalledTimes(1);
            expect(global.Debug.error).toHaveBeenCalledWith(
                'CRITICAL: Token database failed to load. Cannot initialize scanner.'
            );
        });
    });

    describe('TEST 3: TokenManager exception handling', () => {
        it('should propagate TokenManager.loadDatabase exceptions', async () => {
            // ARRANGE
            const networkError = new Error('Network error: fetch failed');
            mockTokenManager.loadDatabase.mockRejectedValue(networkError);

            // ACT & ASSERT
            await expect(
                loadTokenDatabase(mockTokenManager, mockUIManager)
            ).rejects.toThrow('Network error: fetch failed');
        });

        it('should not show UI error for TokenManager exceptions (let caller handle)', async () => {
            // ARRANGE
            const networkError = new Error('Network error: fetch failed');
            mockTokenManager.loadDatabase.mockRejectedValue(networkError);

            // ACT
            try {
                await loadTokenDatabase(mockTokenManager, mockUIManager);
            } catch (e) {
                // Expected to throw
            }

            // ASSERT
            // Should NOT show error UI - exception is propagated for caller to handle
            expect(mockUIManager.showError).not.toHaveBeenCalled();
        });
    });

    describe('TEST 4: Contract validation', () => {
        it('should call TokenManager.loadDatabase exactly once', async () => {
            // ARRANGE
            mockTokenManager.loadDatabase.mockResolvedValue(true);

            // ACT
            await loadTokenDatabase(mockTokenManager, mockUIManager);

            // ASSERT
            expect(mockTokenManager.loadDatabase).toHaveBeenCalledTimes(1);
            expect(mockTokenManager.loadDatabase).toHaveBeenCalledWith(); // No arguments
        });

        it('should return boolean true on success', async () => {
            // ARRANGE
            mockTokenManager.loadDatabase.mockResolvedValue(true);

            // ACT
            const result = await loadTokenDatabase(mockTokenManager, mockUIManager);

            // ASSERT
            expect(typeof result).toBe('boolean');
            expect(result).toBe(true);
        });
    });

    describe('TEST 5: Demo data removal validation', () => {
        it('should NOT fall back to demo data when load fails', async () => {
            // ARRANGE
            mockTokenManager.loadDatabase.mockResolvedValue(false);

            // ACT & ASSERT
            // Should throw instead of falling back to demo data
            await expect(
                loadTokenDatabase(mockTokenManager, mockUIManager)
            ).rejects.toThrow('Token database initialization failed');

            // Should NOT log "Using demo data"
            expect(global.Debug.log).not.toHaveBeenCalledWith(
                expect.stringContaining('demo data')
            );
        });

        it('should NOT log "Using demo data" message on failure', async () => {
            // ARRANGE
            mockTokenManager.loadDatabase.mockResolvedValue(false);

            // ACT
            try {
                await loadTokenDatabase(mockTokenManager, mockUIManager);
            } catch (e) {
                // Expected to throw
            }

            // ASSERT
            const allLogCalls = global.Debug.log.mock.calls.flat();
            const hasDemo = allLogCalls.some(msg =>
                typeof msg === 'string' && msg.toLowerCase().includes('demo')
            );
            expect(hasDemo).toBe(false);
        });
    });
});
