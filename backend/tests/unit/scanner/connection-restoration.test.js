/**
 * Unit Tests: Connection Restoration Logic
 * Tests for extracted connection restoration functions
 *
 * Phase 1C of initialization refactoring
 */

const path = require('path');

// Set up Debug mocks BEFORE loading browser-mocks
// This ensures the mocked functions are captured by InitializationSteps
global.Debug = {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
};

// Load browser environment mocks (will use above Debug mock)
require('../../helpers/browser-mocks');

describe('Connection Restoration Logic', () => {
    let determineInitialScreen;
    let applyInitialScreenDecision;

    beforeEach(() => {
        // Clear all mocks
        jest.clearAllMocks();

        // Import the functions we're testing
        try {
            const initSteps = require('../../../../ALNScanner/js/app/initializationSteps');
            determineInitialScreen = initSteps.determineInitialScreen;
            applyInitialScreenDecision = initSteps.applyInitialScreenDecision;
        } catch (e) {
            // Functions don't exist yet - expected for TDD
            console.error('Failed to load connection restoration functions:', e.message);
            determineInitialScreen = null;
            applyInitialScreenDecision = null;
        }
    });

    describe('determineInitialScreen (Decision Logic)', () => {
        describe('TEST 1: No saved mode (first-time user)', () => {
            it('should return gameModeScreen with no action when no saved mode', () => {
                // ARRANGE
                const mockSessionModeManager = {
                    restoreMode: jest.fn().mockReturnValue(null),
                    isConnectionReady: jest.fn()
                };

                // ACT
                const decision = determineInitialScreen(mockSessionModeManager);

                // ASSERT
                expect(decision).toEqual({
                    screen: 'gameModeScreen',
                    action: null
                });
                expect(mockSessionModeManager.restoreMode).toHaveBeenCalledTimes(1);
                expect(mockSessionModeManager.isConnectionReady).not.toHaveBeenCalled(); // Shouldn't check if no saved mode
            });

            it('should return gameModeScreen when restoreMode returns false', () => {
                // ARRANGE
                const mockSessionModeManager = {
                    restoreMode: jest.fn().mockReturnValue(false),
                    isConnectionReady: jest.fn()
                };

                // ACT
                const decision = determineInitialScreen(mockSessionModeManager);

                // ASSERT
                expect(decision.screen).toBe('gameModeScreen');
                expect(decision.action).toBe(null);
            });

            it('should return gameModeScreen when restoreMode returns empty string', () => {
                // ARRANGE
                const mockSessionModeManager = {
                    restoreMode: jest.fn().mockReturnValue(''),
                    isConnectionReady: jest.fn()
                };

                // ACT
                const decision = determineInitialScreen(mockSessionModeManager);

                // ASSERT
                expect(decision.screen).toBe('gameModeScreen');
                expect(decision.action).toBe(null);
            });
        });

        describe('TEST 2: Saved mode with connection ready (happy path)', () => {
            it('should return teamEntry screen when saved mode and connection ready', () => {
                // ARRANGE
                const mockSessionModeManager = {
                    restoreMode: jest.fn().mockReturnValue('networked'),
                    isConnectionReady: jest.fn().mockReturnValue(true)
                };

                // ACT
                const decision = determineInitialScreen(mockSessionModeManager);

                // ASSERT
                expect(decision).toEqual({
                    screen: 'teamEntry',
                    action: null
                });
                expect(mockSessionModeManager.restoreMode).toHaveBeenCalledTimes(1);
                expect(mockSessionModeManager.isConnectionReady).toHaveBeenCalledTimes(1);
            });

            it('should return teamEntry for standalone mode (always ready)', () => {
                // ARRANGE
                const mockSessionModeManager = {
                    restoreMode: jest.fn().mockReturnValue('standalone'),
                    isConnectionReady: jest.fn().mockReturnValue(true)
                };

                // ACT
                const decision = determineInitialScreen(mockSessionModeManager);

                // ASSERT
                expect(decision.screen).toBe('teamEntry');
                expect(decision.action).toBe(null);
            });
        });

        describe('TEST 3: Saved mode with connection lost (error recovery)', () => {
            it('should return clearModeAndShowWizard action when connection lost', () => {
                // ARRANGE
                const mockSessionModeManager = {
                    restoreMode: jest.fn().mockReturnValue('networked'),
                    isConnectionReady: jest.fn().mockReturnValue(false)
                };

                // ACT
                const decision = determineInitialScreen(mockSessionModeManager);

                // ASSERT
                expect(decision).toEqual({
                    screen: 'gameModeScreen',
                    action: 'clearModeAndShowWizard'
                });
                expect(mockSessionModeManager.restoreMode).toHaveBeenCalledTimes(1);
                expect(mockSessionModeManager.isConnectionReady).toHaveBeenCalledTimes(1);
            });

            it('should return clearModeAndShowWizard for any truthy mode with lost connection', () => {
                // ARRANGE
                const mockSessionModeManager = {
                    restoreMode: jest.fn().mockReturnValue('some-mode'),
                    isConnectionReady: jest.fn().mockReturnValue(false)
                };

                // ACT
                const decision = determineInitialScreen(mockSessionModeManager);

                // ASSERT
                expect(decision.screen).toBe('gameModeScreen');
                expect(decision.action).toBe('clearModeAndShowWizard');
            });
        });

        describe('TEST 4: Pure function behavior', () => {
            it('should not mutate sessionModeManager', () => {
                // ARRANGE
                const mockSessionModeManager = {
                    restoreMode: jest.fn().mockReturnValue('networked'),
                    isConnectionReady: jest.fn().mockReturnValue(true),
                    someProperty: 'original'
                };

                // ACT
                determineInitialScreen(mockSessionModeManager);

                // ASSERT
                expect(mockSessionModeManager.someProperty).toBe('original');
                // Only read methods called, no write methods
            });

            it('should be deterministic (same input = same output)', () => {
                // ARRANGE
                const mockSessionModeManager = {
                    restoreMode: jest.fn().mockReturnValue('networked'),
                    isConnectionReady: jest.fn().mockReturnValue(false)
                };

                // ACT
                const decision1 = determineInitialScreen(mockSessionModeManager);
                const decision2 = determineInitialScreen(mockSessionModeManager);

                // ASSERT
                expect(decision1).toEqual(decision2);
            });
        });
    });

    describe('applyInitialScreenDecision (Side Effects)', () => {
        let mockSessionModeManager;
        let mockUIManager;
        let mockShowWizard;

        beforeEach(() => {
            mockSessionModeManager = {
                clearMode: jest.fn()
            };
            mockUIManager = {
                showScreen: jest.fn()
            };
            mockShowWizard = jest.fn();
        });

        describe('TEST 5: Apply no action (simple screen change)', () => {
            it('should only show screen when action is null', () => {
                // ARRANGE
                const decision = {
                    screen: 'gameModeScreen',
                    action: null
                };

                // ACT
                applyInitialScreenDecision(decision, mockSessionModeManager, mockUIManager, mockShowWizard);

                // ASSERT
                expect(mockUIManager.showScreen).toHaveBeenCalledWith('gameModeScreen');
                expect(mockUIManager.showScreen).toHaveBeenCalledTimes(1);
                expect(mockSessionModeManager.clearMode).not.toHaveBeenCalled();
                expect(mockShowWizard).not.toHaveBeenCalled();
            });

            it('should show teamEntry screen when action is null', () => {
                // ARRANGE
                const decision = {
                    screen: 'teamEntry',
                    action: null
                };

                // ACT
                applyInitialScreenDecision(decision, mockSessionModeManager, mockUIManager, mockShowWizard);

                // ASSERT
                expect(mockUIManager.showScreen).toHaveBeenCalledWith('teamEntry');
                expect(mockSessionModeManager.clearMode).not.toHaveBeenCalled();
                expect(mockShowWizard).not.toHaveBeenCalled();
            });
        });

        describe('TEST 6: Apply clearModeAndShowWizard action', () => {
            it('should clear mode, show screen, and show wizard when action specified', () => {
                // ARRANGE
                const decision = {
                    screen: 'gameModeScreen',
                    action: 'clearModeAndShowWizard'
                };

                // ACT
                applyInitialScreenDecision(decision, mockSessionModeManager, mockUIManager, mockShowWizard);

                // ASSERT
                // Should execute in this order:
                expect(mockSessionModeManager.clearMode).toHaveBeenCalledTimes(1);
                expect(mockUIManager.showScreen).toHaveBeenCalledWith('gameModeScreen');
                expect(mockShowWizard).toHaveBeenCalledTimes(1);
            });

            it('should call functions in correct order (clearMode → showScreen → showWizard)', () => {
                // ARRANGE
                const decision = {
                    screen: 'gameModeScreen',
                    action: 'clearModeAndShowWizard'
                };
                const callOrder = [];
                mockSessionModeManager.clearMode.mockImplementation(() => callOrder.push('clearMode'));
                mockUIManager.showScreen.mockImplementation(() => callOrder.push('showScreen'));
                mockShowWizard.mockImplementation(() => callOrder.push('showWizard'));

                // ACT
                applyInitialScreenDecision(decision, mockSessionModeManager, mockUIManager, mockShowWizard);

                // ASSERT
                expect(callOrder).toEqual(['clearMode', 'showScreen', 'showWizard']);
            });
        });

        describe('TEST 7: Debug logging', () => {
            it('should log when showing screen without action', () => {
                // ARRANGE
                const decision = {
                    screen: 'teamEntry',
                    action: null
                };

                // ACT
                applyInitialScreenDecision(decision, mockSessionModeManager, mockUIManager, mockShowWizard);

                // ASSERT
                expect(global.Debug.log).toHaveBeenCalledWith('Showing initial screen: teamEntry');
            });

            it('should warn when clearing mode due to lost connection', () => {
                // ARRANGE
                const decision = {
                    screen: 'gameModeScreen',
                    action: 'clearModeAndShowWizard'
                };

                // ACT
                applyInitialScreenDecision(decision, mockSessionModeManager, mockUIManager, mockShowWizard);

                // ASSERT
                expect(global.Debug.warn).toHaveBeenCalledWith(
                    'Networked mode restored but connection lost - showing wizard'
                );
            });
        });

        describe('TEST 8: Contract validation', () => {
            it('should handle decision with all required fields', () => {
                // ARRANGE
                const decision = {
                    screen: 'gameModeScreen',
                    action: null
                };

                // ACT & ASSERT
                expect(() => {
                    applyInitialScreenDecision(decision, mockSessionModeManager, mockUIManager, mockShowWizard);
                }).not.toThrow();
            });

            it('should call showScreen exactly once per invocation', () => {
                // ARRANGE
                const decision = {
                    screen: 'teamEntry',
                    action: null
                };

                // ACT
                applyInitialScreenDecision(decision, mockSessionModeManager, mockUIManager, mockShowWizard);

                // ASSERT
                expect(mockUIManager.showScreen).toHaveBeenCalledTimes(1);
            });
        });
    });
});
