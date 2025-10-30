/**
 * UIManager Unit Tests
 * Phase 5.1: Critical User Interface Testing
 *
 * CRITICAL: UIManager is the ENTIRE user interface
 * - Without error display → Decision #10 violated (users blind to problems)
 * - Without screen navigation → app unusable
 * - Without real-time updates → game state invisible
 * - Without scoreboard → competitive gameplay broken
 *
 * Priority: HIGHEST (user-facing critical path)
 */

const path = require('path');

describe('UIManager - Critical User Interface', () => {
  let UIManager;
  let mockDocument;
  let mockElements;
  let mockBody;

  beforeEach(() => {
    // Reset module cache to get fresh instance
    jest.resetModules();

    // Create comprehensive DOM mocks
    mockElements = {};
    mockBody = {
      appendChild: jest.fn((element) => {
        // Track elements appended to body by id (for error-container, etc.)
        if (element.id) {
          mockElements[element.id] = element;
        }
      }),
      removeChild: jest.fn()
    };

    // Mock document with all methods UIManager uses
    mockDocument = {
      getElementById: jest.fn((id) => {
        // Return null if element doesn't exist yet (match browser behavior)
        if (!mockElements[id]) {
          return null;
        }
        return mockElements[id];
      }),
      querySelector: jest.fn(),
      createElement: jest.fn((tag) => {
        const element = {
          tagName: tag,
          id: '',
          className: '',
          _textContent: '',
          style: {},
          appendChild: jest.fn(),
          remove: jest.fn()
        };
        // Define textContent with getter/setter to coerce values to string (match browser)
        Object.defineProperty(element, 'textContent', {
          get() { return this._textContent; },
          set(value) { this._textContent = String(value); }
        });
        return element;
      }),
      body: mockBody
    };

    // Mock global objects
    global.document = mockDocument;
    global.window = {
      sessionModeManager: {
        isNetworked: jest.fn().mockReturnValue(true)
      }
    };
    global.Settings = { mode: 'blackmarket' };
    global.DataManager = {
      transactions: [],
      getSessionStats: jest.fn(() => ({ count: 0, totalScore: 0, totalValue: 0 })),
      getGlobalStats: jest.fn(() => ({ total: 0, teams: 0, totalValue: 0, avgValue: 0 })),
      getTeamScores: jest.fn(() => []),
      getEnhancedTeamTransactions: jest.fn(() => ({
        hasCompletedGroups: false,
        hasIncompleteGroups: false,
        hasUngroupedTokens: false,
        hasUnknownTokens: false,
        completedGroups: [],
        incompleteGroups: [],
        ungroupedTokens: [],
        unknownTokens: []
      })),
      calculateTeamScoreWithBonuses: jest.fn(() => ({
        baseScore: 0,
        bonusScore: 0,
        totalScore: 0
      })),
      calculateTokenValue: jest.fn(() => 1000),
      parseGroupInfo: jest.fn(() => ({ multiplier: 1 }))
    };
    global.App = {
      showTeamDetails: jest.fn(),
      viewController: { currentView: 'scanner' }
    };

    // Load UIManager
    UIManager = require('../../../../ALNScanner/js/ui/uiManager');
  });

  afterEach(() => {
    delete global.document;
    delete global.Settings;
    delete global.DataManager;
    delete global.App;
  });

  // ============================================================================
  // CRITICAL TEST GROUP 1: DECISION #10 - ERROR DISPLAY (HIGHEST PRIORITY)
  // REWRITTEN: Phase 5 - Eliminate smoke tests, add behavioral verification
  // ============================================================================

  describe('Decision #10: Error Display (CRITICAL)', () => {
    it('should initialize error display container on init()', () => {
      // Initialize UIManager
      UIManager.init();

      // BEHAVIORAL: Verify actual container properties
      expect(UIManager.errorContainer).toBeDefined();
      expect(UIManager.errorContainer).not.toBeNull();
      expect(UIManager.errorContainer.id).toBe('error-container');
      expect(UIManager.errorContainer.className).toBe('error-container');
    });

    it('should create error container if missing when showError called', () => {
      // Don't call init() - errorContainer is null
      expect(UIManager.errorContainer).toBeNull();

      // Call showError
      UIManager.showError('Test error');

      // BEHAVIORAL: Verify container auto-initialized with correct properties
      expect(UIManager.errorContainer).not.toBeNull();
      expect(UIManager.errorContainer.id).toBe('error-container');
    });

    it('should create error div with correct class and textContent', () => {
      const message = 'Authentication failed';

      UIManager.showError(message);

      // BEHAVIORAL: Get actual created error div and verify properties
      const errorDivs = mockDocument.createElement.mock.results
        .filter(r => r.value.tagName === 'div');
      const errorDiv = errorDivs[errorDivs.length - 1]?.value;

      expect(errorDiv).toBeDefined();
      expect(errorDiv.className).toBe('error-message');
      expect(errorDiv.textContent).toBe('Authentication failed');
    });

    it('should append error to errorContainer', () => {
      UIManager.init();
      const appendSpy = jest.spyOn(UIManager.errorContainer, 'appendChild');

      UIManager.showError('Test error');

      // BEHAVIORAL: Verify correct element appended
      expect(appendSpy).toHaveBeenCalledTimes(1);
      const appendedElement = appendSpy.mock.calls[0][0];
      expect(appendedElement.className).toBe('error-message');
      expect(appendedElement.textContent).toBe('Test error');
    });

    it('should auto-dismiss error after default duration (5000ms)', () => {
      jest.useFakeTimers();

      UIManager.showError('Test error');

      const errorDivs = mockDocument.createElement.mock.results
        .filter(r => r.value.tagName === 'div');
      const errorDiv = errorDivs[errorDivs.length - 1]?.value;

      expect(errorDiv).toBeDefined();

      // Fast-forward time by 5000ms
      jest.advanceTimersByTime(5000);

      // BEHAVIORAL: Verify animation style applied
      expect(errorDiv.style.animation).toBe('slideOut 0.3s ease-out forwards');

      // Fast-forward additional 300ms for animation
      jest.advanceTimersByTime(300);

      // BEHAVIORAL: Verify remove called
      expect(errorDiv.remove).toHaveBeenCalled();

      jest.useRealTimers();
    });

    it('should auto-dismiss error after custom duration', () => {
      jest.useFakeTimers();

      UIManager.showError('Test error', 2000);

      const errorDivs = mockDocument.createElement.mock.results
        .filter(r => r.value.tagName === 'div');
      const errorDiv = errorDivs[errorDivs.length - 1]?.value;

      // Fast-forward by 2000ms (custom duration)
      jest.advanceTimersByTime(2000);

      // BEHAVIORAL: Verify custom duration honored
      expect(errorDiv.style.animation).toBe('slideOut 0.3s ease-out forwards');

      jest.useRealTimers();
    });

    it('should create toast with correct type classes and content', () => {
      const types = ['info', 'success', 'warning', 'error'];

      types.forEach(type => {
        jest.clearAllMocks(); // Clear between iterations

        UIManager.showToast(`Test ${type}`, type);

        // BEHAVIORAL: Get last created div and verify properties
        const divs = mockDocument.createElement.mock.results
          .filter(r => r.value.tagName === 'div');
        const toast = divs[divs.length - 1]?.value;

        expect(toast.className).toBe(`toast toast-${type}`);
        expect(toast.textContent).toBe(`Test ${type}`);
      });
    });

    it('should auto-dismiss toast after default duration (3000ms)', () => {
      jest.useFakeTimers();

      UIManager.showToast('Test toast');

      const divs = mockDocument.createElement.mock.results
        .filter(r => r.value.tagName === 'div');
      const toast = divs[divs.length - 1]?.value;

      // Fast-forward by 3000ms (default toast duration)
      jest.advanceTimersByTime(3000);

      // BEHAVIORAL: Verify toast dismissal
      expect(toast.style.animation).toBe('slideOut 0.3s ease-out forwards');

      jest.useRealTimers();
    });

    it('should handle multiple concurrent error messages', () => {
      UIManager.init();
      const appendSpy = jest.spyOn(UIManager.errorContainer, 'appendChild');

      UIManager.showError('Error 1');
      UIManager.showError('Error 2');
      UIManager.showError('Error 3');

      // BEHAVIORAL: Verify all 3 errors appended with correct content
      expect(appendSpy).toHaveBeenCalledTimes(3);
      expect(appendSpy.mock.calls[0][0].textContent).toBe('Error 1');
      expect(appendSpy.mock.calls[1][0].textContent).toBe('Error 2');
      expect(appendSpy.mock.calls[2][0].textContent).toBe('Error 3');
    });
  });

  // ============================================================================
  // CRITICAL TEST GROUP 2: SCREEN NAVIGATION
  // ============================================================================

  describe('Screen Navigation (CRITICAL)', () => {
    beforeEach(() => {
      // Create mock screen elements (before init so getElementById finds them)
      const screenNames = [
        'loadingScreen', 'settingsScreen', 'gameModeScreen',
        'teamEntryScreen', 'scanScreen', 'resultScreen',
        'historyScreen', 'scoreboardScreen', 'teamDetailsScreen'
      ];

      screenNames.forEach(name => {
        const element = {
          id: name,
          _textContent: '',
          classList: {
            add: jest.fn(),
            remove: jest.fn(),
            contains: jest.fn(() => false)
          }
        };
        // Add textContent getter/setter
        Object.defineProperty(element, 'textContent', {
          get() { return this._textContent; },
          set(value) { this._textContent = String(value); }
        });
        mockElements[name] = element;
      });

      UIManager.init();
    });

    it('should initialize all 9 screen references', () => {
      expect(UIManager.screens.loading).toBeDefined();
      expect(UIManager.screens.settings).toBeDefined();
      expect(UIManager.screens.gameModeScreen).toBeDefined();
      expect(UIManager.screens.teamEntry).toBeDefined();
      expect(UIManager.screens.scan).toBeDefined();
      expect(UIManager.screens.result).toBeDefined();
      expect(UIManager.screens.history).toBeDefined();
      expect(UIManager.screens.scoreboard).toBeDefined();
      expect(UIManager.screens.teamDetails).toBeDefined();
    });

    it('should show requested screen and hide all others', () => {
      // Mock querySelector to return currently active screen
      mockDocument.querySelector.mockReturnValue(mockElements.scanScreen);
      mockElements.scanScreen.classList.contains = jest.fn(() => true);

      UIManager.showScreen('result');

      // All screens should have 'active' removed
      Object.values(UIManager.screens).forEach(screen => {
        expect(screen.classList.remove).toHaveBeenCalledWith('active');
      });

      // Result screen should have 'active' added
      expect(UIManager.screens.result.classList.add).toHaveBeenCalledWith('active');
    });

    it('should track previous screen for back navigation', () => {
      // Current screen is 'scan'
      const currentScreen = {
        id: 'scanScreen',
        classList: { contains: () => true }
      };
      mockDocument.querySelector.mockReturnValue(currentScreen);

      UIManager.showScreen('result');

      // Previous screen should be tracked (without 'Screen' suffix)
      expect(UIManager.previousScreen).toBe('scan');
    });

    it('should NOT track modal screens as previous screen', () => {
      const modalScreens = ['history', 'scoreboard', 'teamDetails'];

      modalScreens.forEach(screenName => {
        UIManager.previousScreen = 'scan'; // Reset

        // Current screen is modal
        mockDocument.querySelector.mockReturnValue({
          id: `${screenName}Screen`
        });

        UIManager.showScreen('result');

        // Previous screen should still be 'scan' (not the modal)
        expect(UIManager.previousScreen).toBe('scan');
      });
    });

    it('should handle showing non-existent screen gracefully', () => {
      expect(() => {
        UIManager.showScreen('nonExistentScreen');
      }).not.toThrow();

      // Should still hide all screens
      Object.values(UIManager.screens).forEach(screen => {
        expect(screen.classList.remove).toHaveBeenCalledWith('active');
      });
    });
  });

  // ============================================================================
  // CRITICAL TEST GROUP 3: MODE DISPLAY UPDATES
  // ============================================================================

  describe('Mode Display Updates (CRITICAL)', () => {
    beforeEach(() => {
      // Create required DOM elements
      ['modeIndicator', 'modeText', 'modeToggle', 'scoreboardButton'].forEach(id => {
        const element = {
          id,
          className: '',
          _textContent: '',
          checked: false,
          style: { display: '' }
        };
        Object.defineProperty(element, 'textContent', {
          get() { return this._textContent; },
          set(value) { this._textContent = String(value); }
        });
        mockElements[id] = element;
      });

      UIManager.init();
    });

    it('should update display for blackmarket mode', () => {
      const indicator = mockElements.modeIndicator;
      const modeText = mockElements.modeText;
      const toggle = mockElements.modeToggle;

      UIManager.updateModeDisplay('blackmarket');

      expect(indicator.className).toBe('mode-indicator mode-blackmarket');
      expect(indicator.textContent).toBe('Black Market Mode');
      expect(modeText.textContent).toBe('Black Market Mode');
      expect(toggle.checked).toBe(true);
    });

    it('should update display for detective mode', () => {
      const indicator = mockElements.modeIndicator;
      const modeText = mockElements.modeText;
      const toggle = mockElements.modeToggle;

      UIManager.updateModeDisplay('detective');

      expect(indicator.className).toBe('mode-indicator mode-detective');
      expect(indicator.textContent).toBe('Detective Mode');
      expect(modeText.textContent).toBe('Detective Mode');
      expect(toggle.checked).toBe(false);
    });

    it('should update navigation buttons based on mode', () => {
      const scoreboardButton = mockDocument.getElementById('scoreboardButton');

      // Black Market mode - scoreboard visible
      global.Settings.mode = 'blackmarket';
      UIManager.updateNavigationButtons();
      expect(scoreboardButton.style.display).toBe('block');

      // Detective mode - scoreboard hidden
      global.Settings.mode = 'detective';
      UIManager.updateNavigationButtons();
      expect(scoreboardButton.style.display).toBe('none');
    });

    it('should handle missing optional elements gracefully (modeText, toggle)', () => {
      // Return null for optional elements
      const originalGetElementById = mockDocument.getElementById;
      mockDocument.getElementById = jest.fn((id) => {
        if (id === 'modeText' || id === 'modeToggle') return null;
        return originalGetElementById(id);
      });

      // Should not throw
      expect(() => {
        UIManager.updateModeDisplay('blackmarket');
      }).not.toThrow();

      mockDocument.getElementById = originalGetElementById;
    });
  });

  // ============================================================================
  // CRITICAL TEST GROUP 4: TEAM DISPLAY
  // ============================================================================

  describe('Team Display (CRITICAL)', () => {
    beforeEach(() => {
      // Create teamDisplay element
      const teamDisplay = { textContent: '' };
      mockElements['teamDisplay'] = teamDisplay;
    });

    it('should display team ID', () => {
      UIManager.init();
      const display = mockElements['teamDisplay'];

      UIManager.updateTeamDisplay('001');

      expect(display.textContent).toBe('001');
    });

    it('should display underscore when no team selected', () => {
      UIManager.init();
      const display = mockElements['teamDisplay'];

      UIManager.updateTeamDisplay(null);

      expect(display.textContent).toBe('_');
    });

    it('should display underscore for undefined team', () => {
      UIManager.init();
      const display = mockElements['teamDisplay'];

      UIManager.updateTeamDisplay(undefined);

      expect(display.textContent).toBe('_');
    });
  });

  // ============================================================================
  // CRITICAL TEST GROUP 5: SESSION STATS UPDATES (Real-Time Data)
  // ============================================================================

  describe('Session Stats Updates (CRITICAL)', () => {
    beforeEach(() => {
      // Create required DOM elements
      ['teamTokenCount', 'teamTotalValue', 'teamValueLabel'].forEach(id => {
        const element = {
          id,
          _textContent: ''
        };
        Object.defineProperty(element, 'textContent', {
          get() { return this._textContent; },
          set(value) { this._textContent = String(value); }
        });
        mockElements[id] = element;
      });

      UIManager.init();
    });

    it('should update session stats in blackmarket mode with score format', () => {
      global.Settings.mode = 'blackmarket';
      global.DataManager.getSessionStats.mockReturnValue({
        count: 8,
        totalScore: 15000,
        totalValue: 15
      });

      const countElement = mockElements.teamTokenCount;
      const valueElement = mockElements.teamTotalValue;
      const labelElement = mockElements.teamValueLabel;

      UIManager.updateSessionStats();

      expect(countElement.textContent).toBe('8');
      expect(valueElement.textContent).toBe('$15,000');
      expect(labelElement.textContent).toBe('Score');
    });

    it('should update session stats in detective mode with value format', () => {
      global.Settings.mode = 'detective';
      global.DataManager.getSessionStats.mockReturnValue({
        count: 5,
        totalScore: 0,
        totalValue: 12
      });

      const countElement = mockElements.teamTokenCount;
      const valueElement = mockElements.teamTotalValue;
      const labelElement = mockElements.teamValueLabel;

      UIManager.updateSessionStats();

      expect(countElement.textContent).toBe('5');
      expect(valueElement.textContent).toBe('12');
      expect(labelElement.textContent).toBe('Total Value');
    });

    it('should handle zero stats', () => {
      global.DataManager.getSessionStats.mockReturnValue({
        count: 0,
        totalScore: 0,
        totalValue: 0
      });

      const countElement = mockElements.teamTokenCount;
      const valueElement = mockElements.teamTotalValue;

      UIManager.updateSessionStats();

      expect(countElement.textContent).toBe('0');
      expect(valueElement.textContent).toBe('$0');
    });
  });

  // ============================================================================
  // STEP 3: SCOREBOARD RENDERING TESTS
  // ============================================================================

  describe('renderScoreboard() - Scoreboard Display (STEP 3)', () => {
    let scoreboardContainer;

    beforeEach(() => {
      // Create scoreboard container element
      scoreboardContainer = {
        _innerHTML: ''
      };
      Object.defineProperty(scoreboardContainer, 'innerHTML', {
        get() { return this._innerHTML; },
        set(value) { this._innerHTML = value; }
      });
      mockElements.scoreboardContainer = scoreboardContainer;

      UIManager.init();
    });

    it('should show empty state when no teams exist', () => {
      global.DataManager.getTeamScores.mockReturnValue([]);

      UIManager.renderScoreboard();

      // BEHAVIORAL: Verify empty state HTML structure
      expect(scoreboardContainer.innerHTML).toContain('empty-state');
      expect(scoreboardContainer.innerHTML).toContain('No Teams Yet');
      expect(scoreboardContainer.innerHTML).toContain('Teams will appear here after scanning tokens');
    });

    it('should display score source indicator for backend data', () => {
      global.DataManager.getTeamScores.mockReturnValue([
        { teamId: '001', score: 5000, tokenCount: 3, isFromBackend: true }
      ]);

      UIManager.renderScoreboard();

      // BEHAVIORAL: Verify backend indicator present
      expect(scoreboardContainer.innerHTML).toContain('score-source');
      expect(scoreboardContainer.innerHTML).toContain('🔗 Live from Orchestrator');
      expect(scoreboardContainer.innerHTML).not.toContain('📱 Local Calculation');
    });

    it('should display score source indicator for local data', () => {
      global.DataManager.getTeamScores.mockReturnValue([
        { teamId: '001', score: 5000, tokenCount: 3, isFromBackend: false }
      ]);

      UIManager.renderScoreboard();

      // BEHAVIORAL: Verify local indicator present
      expect(scoreboardContainer.innerHTML).toContain('score-source');
      expect(scoreboardContainer.innerHTML).toContain('📱 Local Calculation');
      expect(scoreboardContainer.innerHTML).not.toContain('🔗 Live from Orchestrator');
    });

    it('should render team rows with correct rank and medal display', () => {
      global.DataManager.getTeamScores.mockReturnValue([
        { teamId: '001', score: 10000, tokenCount: 5, isFromBackend: false },
        { teamId: '002', score: 8000, tokenCount: 4, isFromBackend: false },
        { teamId: '003', score: 6000, tokenCount: 3, isFromBackend: false },
        { teamId: '004', score: 4000, tokenCount: 2, isFromBackend: false }
      ]);

      UIManager.renderScoreboard();

      const html = scoreboardContainer.innerHTML;

      // BEHAVIORAL: Verify rank medals for top 3
      expect(html).toContain('🥇'); // 1st place
      expect(html).toContain('🥈'); // 2nd place
      expect(html).toContain('🥉'); // 3rd place
      expect(html).toContain('#4'); // 4th place (numeric)

      // BEHAVIORAL: Verify rank classes applied to top 3
      expect(html).toContain('rank-1');
      expect(html).toContain('rank-2');
      expect(html).toContain('rank-3');
    });

    it('should format scores with thousand separators', () => {
      global.DataManager.getTeamScores.mockReturnValue([
        { teamId: '001', score: 15000, tokenCount: 8, isFromBackend: false },
        { teamId: '002', score: 250, tokenCount: 1, isFromBackend: false }
      ]);

      UIManager.renderScoreboard();

      const html = scoreboardContainer.innerHTML;

      // BEHAVIORAL: Verify toLocaleString() formatting
      expect(html).toContain('$15,000');
      expect(html).toContain('$250');
    });

    it('should display team ID and token count for each entry', () => {
      global.DataManager.getTeamScores.mockReturnValue([
        { teamId: '007', score: 5000, tokenCount: 12, isFromBackend: false }
      ]);

      UIManager.renderScoreboard();

      const html = scoreboardContainer.innerHTML;

      // BEHAVIORAL: Verify team info display
      expect(html).toContain('Team 007');
      expect(html).toContain('(12 tokens)');
      expect(html).toContain('scoreboard-team');
      expect(html).toContain('scoreboard-score');
    });
  });

  // ============================================================================
  // STEP 4: TEAM DETAILS RENDERING TESTS
  // ============================================================================

  describe('renderTeamDetails() - Team Detail Display (STEP 4)', () => {
    let teamElements;
    let renderTokenCardSpy;

    beforeEach(() => {
      // Create team details DOM elements
      teamElements = {
        teamDetailsTitle: { _textContent: '' },
        teamDetailsSummary: { _textContent: '' },
        teamDetailsContainer: { _innerHTML: '' },
        teamBaseScore: { _textContent: '' },
        teamBonusScore: { _textContent: '' },
        teamTotalScore: { _textContent: '' }
      };

      // Setup getters/setters for textContent and innerHTML
      Object.keys(teamElements).forEach(key => {
        const element = teamElements[key];
        if (key.includes('Container')) {
          Object.defineProperty(element, 'innerHTML', {
            get() { return this._innerHTML; },
            set(value) { this._innerHTML = value; }
          });
        } else {
          Object.defineProperty(element, 'textContent', {
            get() { return this._textContent; },
            set(value) { this._textContent = String(value); }
          });
        }
        mockElements[key] = element;
      });

      // Spy on renderTokenCard to avoid testing it here (tested separately in STEP 5)
      renderTokenCardSpy = jest.spyOn(UIManager, 'renderTokenCard')
        .mockReturnValue('<div class="token-card">Mock Token</div>');

      UIManager.init();
    });

    afterEach(() => {
      renderTokenCardSpy.mockRestore();
    });

    it('should display team header with correct title and summary', () => {
      const mockTransactions = [
        { tokenId: 'abc123' },
        { tokenId: 'def456' },
        { tokenId: 'ghi789' }
      ];

      global.DataManager.getEnhancedTeamTransactions.mockReturnValue({
        hasCompletedGroups: false,
        hasIncompleteGroups: false,
        hasUngroupedTokens: true,
        hasUnknownTokens: false,
        ungroupedTokens: mockTransactions
      });

      global.DataManager.calculateTeamScoreWithBonuses.mockReturnValue({
        baseScore: 5000,
        bonusScore: 2000,
        totalScore: 7000
      });

      UIManager.renderTeamDetails('042', mockTransactions);

      // BEHAVIORAL: Verify header displays team ID
      expect(teamElements.teamDetailsTitle.textContent).toBe('Team 042');

      // BEHAVIORAL: Verify summary shows correct token count with pluralization
      expect(teamElements.teamDetailsSummary.textContent).toBe('3 tokens collected');

      // BEHAVIORAL: Verify score breakdown displays
      expect(teamElements.teamBaseScore.textContent).toBe('$5,000');
      expect(teamElements.teamBonusScore.textContent).toBe('$2,000');
      expect(teamElements.teamTotalScore.textContent).toBe('$7,000');
    });

    it('should render completed groups section with bonus display', () => {
      global.DataManager.getEnhancedTeamTransactions.mockReturnValue({
        hasCompletedGroups: true,
        completedGroups: [
          {
            displayName: 'Detective Files',
            bonusValue: 5000,
            multiplier: 2,
            tokens: [
              { rfid: 'token1', memoryType: 'Technical' },
              { rfid: 'token2', memoryType: 'Personal' }
            ]
          }
        ],
        hasIncompleteGroups: false,
        hasUngroupedTokens: false,
        hasUnknownTokens: false
      });

      global.DataManager.calculateTeamScoreWithBonuses.mockReturnValue({
        baseScore: 3000,
        bonusScore: 5000,
        totalScore: 8000
      });

      UIManager.renderTeamDetails('001', []);

      const html = teamElements.teamDetailsContainer.innerHTML;

      // BEHAVIORAL: Verify completed groups section header
      expect(html).toContain('✅ Completed Groups');
      expect(html).toContain('group-section');
      expect(html).toContain('group-header completed');

      // BEHAVIORAL: Verify group completion badge and name
      expect(html).toContain('🏆');
      expect(html).toContain('Detective Files');
      expect(html).toContain('COMPLETE');

      // BEHAVIORAL: Verify bonus display with formatting
      expect(html).toContain('+$5,000 bonus (2x)');

      // BEHAVIORAL: Verify renderTokenCard called for each token with hasBonus=true
      expect(renderTokenCardSpy).toHaveBeenCalledWith(
        expect.objectContaining({ rfid: 'token1' }),
        true,   // hasBonus flag
        false,  // isUnknown
        true    // showDelete (isNetworked)
      );
      expect(renderTokenCardSpy).toHaveBeenCalledWith(
        expect.objectContaining({ rfid: 'token2' }),
        true,   // hasBonus flag
        false,  // isUnknown
        true    // showDelete (isNetworked)
      );
    });

    it('should render in-progress groups with progress bars', () => {
      global.DataManager.getEnhancedTeamTransactions.mockReturnValue({
        hasCompletedGroups: false,
        hasIncompleteGroups: true,
        incompleteGroups: [
          {
            displayName: 'Evidence (x3)',
            progress: '2/3 tokens',
            percentage: 66.67,
            tokens: [
              { rfid: 'evidence1' },
              { rfid: 'evidence2' }
            ]
          }
        ],
        hasUngroupedTokens: false,
        hasUnknownTokens: false
      });

      global.DataManager.calculateTeamScoreWithBonuses.mockReturnValue({
        baseScore: 2000,
        bonusScore: 0,
        totalScore: 2000
      });

      UIManager.renderTeamDetails('002', []);

      const html = teamElements.teamDetailsContainer.innerHTML;

      // BEHAVIORAL: Verify in-progress section header
      expect(html).toContain('🔶 In Progress Groups');
      expect(html).toContain('group-header in-progress');

      // BEHAVIORAL: Verify progress badge and group name
      expect(html).toContain('⏳');
      expect(html).toContain('Evidence (x3)');
      expect(html).toContain('2/3 tokens');

      // BEHAVIORAL: Verify progress bar with correct percentage
      expect(html).toContain('progress-bar');
      expect(html).toContain('progress-fill');
      expect(html).toContain('width: 66.67%');

      // BEHAVIORAL: Verify tokens rendered without bonus
      expect(renderTokenCardSpy).toHaveBeenCalledWith(
        expect.objectContaining({ rfid: 'evidence1' }),
        false,  // hasBonus=false for incomplete groups
        false,  // isUnknown
        true    // showDelete (isNetworked)
      );
    });

    it('should render ungrouped and unknown token sections', () => {
      global.DataManager.getEnhancedTeamTransactions.mockReturnValue({
        hasCompletedGroups: false,
        hasIncompleteGroups: false,
        hasUngroupedTokens: true,
        ungroupedTokens: [
          { rfid: 'standalone1', memoryType: 'Personal' }
        ],
        hasUnknownTokens: true,
        unknownTokens: [
          { rfid: 'unknown123', isUnknown: true }
        ]
      });

      global.DataManager.calculateTeamScoreWithBonuses.mockReturnValue({
        baseScore: 1000,
        bonusScore: 0,
        totalScore: 1000
      });

      UIManager.renderTeamDetails('003', []);

      const html = teamElements.teamDetailsContainer.innerHTML;

      // BEHAVIORAL: Verify ungrouped section
      expect(html).toContain('📦 Individual Tokens');
      expect(renderTokenCardSpy).toHaveBeenCalledWith(
        expect.objectContaining({ rfid: 'standalone1' }),
        false,  // hasBonus
        false,  // isUnknown
        true    // showDelete (isNetworked)
      );

      // BEHAVIORAL: Verify unknown section
      expect(html).toContain('❓ Unknown Tokens');
      expect(renderTokenCardSpy).toHaveBeenCalledWith(
        expect.objectContaining({ rfid: 'unknown123', isUnknown: true }),
        false,  // hasBonus
        true,   // isUnknown flag
        true    // showDelete (isNetworked)
      );
    });

    it('should display empty state when no transactions exist', () => {
      global.DataManager.getEnhancedTeamTransactions.mockReturnValue({
        hasCompletedGroups: false,
        hasIncompleteGroups: false,
        hasUngroupedTokens: false,
        hasUnknownTokens: false
      });

      global.DataManager.calculateTeamScoreWithBonuses.mockReturnValue({
        baseScore: 0,
        bonusScore: 0,
        totalScore: 0
      });

      UIManager.renderTeamDetails('999', []);

      const html = teamElements.teamDetailsContainer.innerHTML;

      // BEHAVIORAL: Verify empty state HTML
      expect(html).toContain('empty-state');
      expect(html).toContain('No Tokens');
      expect(html).toContain("This team hasn't scanned any tokens yet");

      // BEHAVIORAL: Verify renderTokenCard NOT called for empty state
      expect(renderTokenCardSpy).not.toHaveBeenCalled();
    });
  });

  describe('renderTokenCard() - Token Card HTML Generation', () => {
    it('should render token card with bonus applied styling', () => {
      const token = {
        rfid: 'rat001',
        memoryType: 'Technical',
        valueRating: 3,
        group: 'MARCUS_SUCKS (x2)',
        isUnknown: false
      };

      global.DataManager.calculateTokenValue.mockReturnValue(3000);
      global.DataManager.parseGroupInfo.mockReturnValue({ multiplier: 2 });
      global.DataManager.SCORING_CONFIG = {
        BASE_VALUES: { 1: 500, 2: 1000, 3: 2000, 4: 4000, 5: 8000 },
        TYPE_MULTIPLIERS: { Technical: 1.5, Business: 1.0, Personal: 1.25 }
      };

      const html = UIManager.renderTokenCard(token, true, false);

      // BEHAVIORAL: Verify HTML structure and content
      expect(html).toContain('bonus-applied');
      expect(html).toContain('rat001');
      expect(html).toContain('Technical');
      expect(html).toContain('$6,000'); // 3000 * 2 multiplier
      expect(html).toContain('2,000'); // Base value
      expect(html).toContain('1.5x'); // Type multiplier
      expect(html).toContain('2x'); // Group multiplier
      expect(html).toContain('✅ Bonus Applied'); // Status indicator
    });

    it('should render unknown token with no value', () => {
      const token = {
        rfid: 'UNKNOWN_123',
        memoryType: 'UNKNOWN',
        isUnknown: true,
        group: 'Unknown'
      };

      const html = UIManager.renderTokenCard(token, false, true);

      // BEHAVIORAL: Verify unknown token styling and content
      expect(html).toContain('unknown');
      expect(html).toContain('UNKNOWN_123');
      expect(html).toContain('Unknown token - No value');
      expect(html).toContain('❓ Unknown'); // Status indicator
      expect(html).toContain('N/A'); // Base rating for unknown
    });
  });

  describe('renderTransactions() - Transaction History Rendering', () => {
    beforeEach(() => {
      // Create historyContainer element
      const historyContainer = { innerHTML: '' };
      mockElements['historyContainer'] = historyContainer;
      Object.defineProperty(historyContainer, 'innerHTML', {
        get() { return this._innerHTML || ''; },
        set(value) { this._innerHTML = value; }
      });
    });

    it('should display empty state when no transactions', () => {
      UIManager.renderTransactions([]);

      const html = mockElements['historyContainer'].innerHTML;

      // BEHAVIORAL: Verify empty state HTML
      expect(html).toContain('empty-state');
      expect(html).toContain('No Transactions Yet');
    });

    it('should format values as currency in blackmarket mode', () => {
      const transactions = [{
        teamId: '001',
        timestamp: '2025-10-06T10:00:00Z',
        rfid: 'rat001',
        memoryType: 'Technical',
        valueRating: 3,
        mode: 'blackmarket',
        group: 'MARCUS_SUCKS (x2)',
        isUnknown: false
      }];

      global.DataManager.calculateTokenValue.mockReturnValue(3000);

      UIManager.renderTransactions(transactions);

      const html = mockElements['historyContainer'].innerHTML;

      // BEHAVIORAL: Verify blackmarket mode display
      expect(html).toContain('$3,000'); // Currency format
      expect(html).toContain('Black Market'); // Mode display
      expect(html).toContain('Team 001'); // Team display
      expect(html).toContain('rat001'); // RFID display
      expect(html).toContain('Technical'); // Memory type
      expect(html).toContain('MARCUS_SUCKS (x2)'); // Group display
      expect(html).toContain('blackmarket'); // CSS class
    });

    it('should format values as stars in detective mode', () => {
      const transactions = [{
        teamId: '002',
        timestamp: '2025-10-06T11:30:00Z',
        rfid: 'asm001',
        memoryType: 'Personal',
        valueRating: 3,
        mode: 'detective',
        group: 'SERVER_LOGS (x2)',
        isUnknown: false
      }];

      UIManager.renderTransactions(transactions);

      const html = mockElements['historyContainer'].innerHTML;

      // BEHAVIORAL: Verify detective mode display
      expect(html).toContain('⭐⭐⭐'); // Star format (3 stars for rating 3)
      expect(html).toContain('Detective'); // Mode display
      expect(html).toContain('Team 002'); // Team display
      expect(html).toContain('asm001'); // RFID display
      expect(html).toContain('Personal'); // Memory type
      expect(html).toContain('detective'); // CSS class
    });
  });

  describe('filterTransactions() - Search and Filter Logic', () => {
    beforeEach(() => {
      // Create search and filter input elements
      mockElements['searchFilter'] = { value: '' };
      mockElements['modeFilter'] = { value: '' };

      // Create historyContainer element (required by renderTransactions)
      const historyContainer = { innerHTML: '' };
      mockElements['historyContainer'] = historyContainer;
      Object.defineProperty(historyContainer, 'innerHTML', {
        get() { return this._innerHTML || ''; },
        set(value) { this._innerHTML = value; }
      });
    });

    it('should filter transactions by RFID search', () => {
      const mockTransactions = [
        { rfid: 'rat001', teamId: '001', memoryType: 'Technical', group: 'A', mode: 'blackmarket', timestamp: '2025-10-06T10:00:00Z' },
        { rfid: 'asm001', teamId: '002', memoryType: 'Business', group: 'B', mode: 'detective', timestamp: '2025-10-06T11:00:00Z' }
      ];

      global.DataManager.transactions = mockTransactions;
      mockElements['searchFilter'] = { value: 'rat' };
      mockElements['modeFilter'] = { value: '' };

      const renderSpy = jest.spyOn(UIManager, 'renderTransactions');

      UIManager.filterTransactions();

      // BEHAVIORAL: Verify renderTransactions called with filtered results
      expect(renderSpy).toHaveBeenCalled();
      const filtered = renderSpy.mock.calls[0][0];
      expect(filtered).toHaveLength(1);
      expect(filtered[0].rfid).toBe('rat001');

      renderSpy.mockRestore();
    });

    it('should filter transactions by mode', () => {
      const mockTransactions = [
        { rfid: 'rat001', teamId: '001', memoryType: 'Technical', group: 'A', mode: 'blackmarket', timestamp: '2025-10-06T10:00:00Z' },
        { rfid: 'asm001', teamId: '002', memoryType: 'Business', group: 'B', mode: 'detective', timestamp: '2025-10-06T11:00:00Z' }
      ];

      global.DataManager.transactions = mockTransactions;
      mockElements['searchFilter'] = { value: '' };
      mockElements['modeFilter'] = { value: 'detective' };

      const renderSpy = jest.spyOn(UIManager, 'renderTransactions');

      UIManager.filterTransactions();

      // BEHAVIORAL: Verify mode filter applied correctly
      expect(renderSpy).toHaveBeenCalled();
      const filtered = renderSpy.mock.calls[0][0];
      expect(filtered).toHaveLength(1);
      expect(filtered[0].mode).toBe('detective');

      renderSpy.mockRestore();
    });

    it('should apply both search and mode filter', () => {
      const mockTransactions = [
        { rfid: 'rat001', teamId: '001', memoryType: 'Technical', group: 'A', mode: 'blackmarket', timestamp: '2025-10-06T10:00:00Z' },
        { rfid: 'rat002', teamId: '002', memoryType: 'Business', group: 'B', mode: 'detective', timestamp: '2025-10-06T11:00:00Z' },
        { rfid: 'asm001', teamId: '003', memoryType: 'Personal', group: 'C', mode: 'blackmarket', timestamp: '2025-10-06T12:00:00Z' }
      ];

      global.DataManager.transactions = mockTransactions;
      mockElements['searchFilter'] = { value: 'rat' };
      mockElements['modeFilter'] = { value: 'detective' };

      const renderSpy = jest.spyOn(UIManager, 'renderTransactions');

      UIManager.filterTransactions();

      // BEHAVIORAL: Verify both filters applied (search AND mode)
      expect(renderSpy).toHaveBeenCalled();
      const filtered = renderSpy.mock.calls[0][0];
      expect(filtered).toHaveLength(1);
      expect(filtered[0].rfid).toBe('rat002'); // Only rat002 matches both filters

      renderSpy.mockRestore();
    });
  });

  describe('showTokenResult() - Scan Result Display', () => {
    let showScreenSpy;

    beforeEach(() => {
      // Create result display elements
      mockElements['resultStatus'] = { className: '', innerHTML: '' };
      mockElements['resultRfid'] = { textContent: '' };
      mockElements['resultType'] = { textContent: '', style: { color: '' } };
      mockElements['resultGroup'] = { textContent: '' };
      mockElements['resultValue'] = { textContent: '' };

      // Spy on showScreen
      showScreenSpy = jest.spyOn(UIManager, 'showScreen').mockImplementation(() => {});
    });

    afterEach(() => {
      showScreenSpy.mockRestore();
    });

    it('should display known token with all metadata', () => {
      const token = {
        SF_RFID: 'rat001',
        SF_MemoryType: 'Technical',
        SF_ValueRating: 3,
        SF_Group: 'MARCUS_SUCKS (x2)'
      };

      global.Settings.mode = 'blackmarket';
      global.DataManager.calculateTokenValue.mockReturnValue(3000);

      UIManager.showTokenResult(token, 'rat001', false);

      // BEHAVIORAL: Verify success status display
      expect(mockElements['resultStatus'].className).toBe('status-message success');
      expect(mockElements['resultStatus'].innerHTML).toContain('Transaction Complete!');

      // BEHAVIORAL: Verify token metadata display
      expect(mockElements['resultRfid'].textContent).toBe('rat001');
      expect(mockElements['resultType'].textContent).toBe('Technical');
      expect(mockElements['resultGroup'].textContent).toBe('MARCUS_SUCKS (x2)');
      expect(mockElements['resultValue'].textContent).toBe('$3,000');

      // BEHAVIORAL: Verify showScreen called with 'result'
      expect(showScreenSpy).toHaveBeenCalledWith('result');
    });

    it('should display unknown token with error styling', () => {
      global.Settings.mode = 'blackmarket';

      UIManager.showTokenResult(null, 'UNKNOWN_123', true);

      // BEHAVIORAL: Verify error status display
      expect(mockElements['resultStatus'].className).toBe('status-message error');
      expect(mockElements['resultStatus'].innerHTML).toContain('Unknown Token');

      // BEHAVIORAL: Verify unknown token display
      expect(mockElements['resultRfid'].textContent).toBe('UNKNOWN_123');
      expect(mockElements['resultType'].textContent).toBe('UNKNOWN');
      expect(mockElements['resultType'].style.color).toBe('#FF5722'); // Error color
      expect(mockElements['resultGroup'].textContent).toContain('Raw ID: UNKNOWN_123');
      expect(mockElements['resultValue'].textContent).toBe('$0');

      // BEHAVIORAL: Verify showScreen called with 'result'
      expect(showScreenSpy).toHaveBeenCalledWith('result');
    });
  });
});
