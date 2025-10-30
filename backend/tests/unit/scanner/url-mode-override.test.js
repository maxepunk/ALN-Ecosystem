/**
 * Unit Tests: URL Parameter Mode Override
 * Tests for extracted applyURLModeOverride() function
 *
 * Phase 1B of initialization refactoring
 */

const path = require('path');

// Mock Debug globally before any imports
global.Debug = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
};

describe('URL Parameter Mode Override', () => {
    let applyURLModeOverride;
    let mockSettings;

    beforeEach(() => {
        // Clear all mocks
        jest.clearAllMocks();

        // Create fresh mock for each test
        mockSettings = {
            mode: 'detective',  // Default mode
            save: jest.fn()
        };

        // Import the function we're testing
        try {
            const initSteps = require('../../../../ALNScanner/js/app/initializationSteps');
            applyURLModeOverride = initSteps.applyURLModeOverride;
        } catch (e) {
            // Function doesn't exist yet - expected for TDD
            console.error('Failed to load applyURLModeOverride:', e.message);
            applyURLModeOverride = null;
        }
    });

    describe('TEST 1: Blackmarket mode parameter', () => {
        it('should set station mode to blackmarket when ?mode=blackmarket', () => {
            // ARRANGE
            const locationSearch = '?mode=blackmarket';

            // ACT
            const result = applyURLModeOverride(locationSearch, mockSettings);

            // ASSERT
            expect(mockSettings.mode).toBe('blackmarket');
            expect(mockSettings.save).toHaveBeenCalledTimes(1);
            expect(result).toBe(true);
        });

        it('should set station mode to blackmarket when ?mode=black-market (hyphenated)', () => {
            // ARRANGE
            const locationSearch = '?mode=black-market';

            // ACT
            const result = applyURLModeOverride(locationSearch, mockSettings);

            // ASSERT
            expect(mockSettings.mode).toBe('blackmarket');
            expect(mockSettings.save).toHaveBeenCalledTimes(1);
            expect(result).toBe(true);
        });

        it('should handle blackmarket mode with additional query params', () => {
            // ARRANGE
            const locationSearch = '?foo=bar&mode=blackmarket&baz=qux';

            // ACT
            const result = applyURLModeOverride(locationSearch, mockSettings);

            // ASSERT
            expect(mockSettings.mode).toBe('blackmarket');
            expect(mockSettings.save).toHaveBeenCalledTimes(1);
            expect(result).toBe(true);
        });
    });

    describe('TEST 2: No mode parameter', () => {
        it('should not modify settings when no mode parameter present', () => {
            // ARRANGE
            const locationSearch = '';

            // ACT
            const result = applyURLModeOverride(locationSearch, mockSettings);

            // ASSERT
            expect(mockSettings.mode).toBe('detective');  // Unchanged
            expect(mockSettings.save).not.toHaveBeenCalled();
            expect(result).toBe(false);
        });

        it('should not modify settings when mode parameter is empty', () => {
            // ARRANGE
            const locationSearch = '?mode=';

            // ACT
            const result = applyURLModeOverride(locationSearch, mockSettings);

            // ASSERT
            expect(mockSettings.mode).toBe('detective');  // Unchanged
            expect(mockSettings.save).not.toHaveBeenCalled();
            expect(result).toBe(false);
        });

        it('should not modify settings when other params present but no mode', () => {
            // ARRANGE
            const locationSearch = '?foo=bar&baz=qux';

            // ACT
            const result = applyURLModeOverride(locationSearch, mockSettings);

            // ASSERT
            expect(mockSettings.mode).toBe('detective');  // Unchanged
            expect(mockSettings.save).not.toHaveBeenCalled();
            expect(result).toBe(false);
        });
    });

    describe('TEST 3: Invalid mode parameter', () => {
        it('should ignore invalid mode values', () => {
            // ARRANGE
            const locationSearch = '?mode=detective';  // Valid value but not blackmarket

            // ACT
            const result = applyURLModeOverride(locationSearch, mockSettings);

            // ASSERT
            expect(mockSettings.mode).toBe('detective');  // Unchanged
            expect(mockSettings.save).not.toHaveBeenCalled();
            expect(result).toBe(false);
        });

        it('should ignore unrecognized mode values', () => {
            // ARRANGE
            const locationSearch = '?mode=invalid';

            // ACT
            const result = applyURLModeOverride(locationSearch, mockSettings);

            // ASSERT
            expect(mockSettings.mode).toBe('detective');  // Unchanged
            expect(mockSettings.save).not.toHaveBeenCalled();
            expect(result).toBe(false);
        });
    });

    describe('TEST 4: Case sensitivity', () => {
        it('should handle uppercase MODE parameter', () => {
            // ARRANGE
            const locationSearch = '?MODE=blackmarket';

            // ACT
            const result = applyURLModeOverride(locationSearch, mockSettings);

            // ASSERT
            // URLSearchParams is case-sensitive, so MODE !== mode
            expect(mockSettings.mode).toBe('detective');  // Unchanged
            expect(mockSettings.save).not.toHaveBeenCalled();
            expect(result).toBe(false);
        });

        it('should handle uppercase value (Blackmarket)', () => {
            // ARRANGE
            const locationSearch = '?mode=Blackmarket';

            // ACT
            const result = applyURLModeOverride(locationSearch, mockSettings);

            // ASSERT
            // Values are case-sensitive in URLSearchParams
            expect(mockSettings.mode).toBe('detective');  // Unchanged
            expect(mockSettings.save).not.toHaveBeenCalled();
            expect(result).toBe(false);
        });
    });

    describe('TEST 5: Pure function behavior', () => {
        it('should not mutate the locationSearch parameter', () => {
            // ARRANGE
            const locationSearch = '?mode=blackmarket';
            const originalSearch = locationSearch;

            // ACT
            applyURLModeOverride(locationSearch, mockSettings);

            // ASSERT
            expect(locationSearch).toBe(originalSearch);  // Unchanged
        });

        it('should be idempotent (multiple calls same result)', () => {
            // ARRANGE
            const locationSearch = '?mode=blackmarket';

            // ACT
            const result1 = applyURLModeOverride(locationSearch, mockSettings);
            mockSettings.mode = 'detective';  // Reset
            mockSettings.save.mockClear();
            const result2 = applyURLModeOverride(locationSearch, mockSettings);

            // ASSERT
            expect(result1).toBe(result2);
            expect(mockSettings.mode).toBe('blackmarket');
        });
    });

    describe('TEST 6: Return value validation', () => {
        it('should return true when mode was applied', () => {
            // ARRANGE
            const locationSearch = '?mode=blackmarket';

            // ACT
            const result = applyURLModeOverride(locationSearch, mockSettings);

            // ASSERT
            expect(result).toBe(true);
            expect(typeof result).toBe('boolean');
        });

        it('should return false when no mode was applied', () => {
            // ARRANGE
            const locationSearch = '?foo=bar';

            // ACT
            const result = applyURLModeOverride(locationSearch, mockSettings);

            // ASSERT
            expect(result).toBe(false);
            expect(typeof result).toBe('boolean');
        });
    });
});
