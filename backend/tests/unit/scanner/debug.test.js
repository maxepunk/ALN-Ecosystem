/**
 * Debug Module Unit Tests
 * Tests debug logging utility
 *
 * Phase 5 - STEP 10
 * Tests: Message logging, error handling, message limit, panel updates, console output
 */

describe('Debug Module', () => {
  let Debug;
  let consoleLogSpy, consoleErrorSpy;
  let mockElements;

  beforeAll(() => {
    // Mock CONFIG (required by debug.js)
    global.CONFIG = {
      MAX_DEBUG_MESSAGES: 50
    };
  });

  beforeEach(() => {
    // Reset module cache
    jest.resetModules();

    // Create DOM mocks
    mockElements = {};
    const mockDocument = {
      getElementById: jest.fn((id) => mockElements[id] || null)
    };
    global.document = mockDocument;

    // Import Debug module AFTER mocks are set up
    Debug = require('../../../../ALNScanner/js/utils/debug');

    // Reset Debug state
    Debug.messages = [];

    // Create debugContent element
    const debugContent = {
      textContent: '',
      scrollTop: 0,
      scrollHeight: 100
    };
    mockElements['debugContent'] = debugContent;

    // Spy on console methods
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // Mock App.viewController for updatePanel auto-scroll test
    global.App = {
      viewController: {
        currentView: 'scanner',
        switchView: jest.fn()  // Add switchView method for toggle() tests
      }
    };
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    delete global.App;
  });

  describe('log() - Message Logging', () => {
    it('should log normal message with timestamp and checkmark prefix', () => {
      Debug.log('Test message', false);

      // BEHAVIORAL: Verify message format
      expect(Debug.messages).toHaveLength(1);
      const message = Debug.messages[0];
      expect(message).toContain('✓'); // Checkmark prefix
      expect(message).toContain('Test message');
      expect(message).toMatch(/\[\d{1,2}:\d{2}:\d{2}.*\]/); // Timestamp format

      // BEHAVIORAL: Verify console.log called
      expect(consoleLogSpy).toHaveBeenCalledWith('Test message');
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should log error message with timestamp and error prefix', () => {
      Debug.log('Error occurred', true);

      // BEHAVIORAL: Verify error message format
      expect(Debug.messages).toHaveLength(1);
      const message = Debug.messages[0];
      expect(message).toContain('❌'); // Error prefix
      expect(message).toContain('Error occurred');
      expect(message).toMatch(/\[\d{1,2}:\d{2}:\d{2}.*\]/); // Timestamp format

      // BEHAVIORAL: Verify console.error called (NOT console.log)
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error occurred');
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should maintain message array with max limit (50 messages)', () => {
      // Add 52 messages (exceeds MAX_DEBUG_MESSAGES = 50)
      for (let i = 1; i <= 52; i++) {
        Debug.log(`Message ${i}`);
      }

      // BEHAVIORAL: Verify array limited to 50 messages
      expect(Debug.messages).toHaveLength(50);

      // BEHAVIORAL: Verify oldest messages removed (shift behavior)
      // First message should be "Message 3" (1 and 2 removed)
      expect(Debug.messages[0]).toContain('Message 3');
      expect(Debug.messages[0]).not.toContain('Message 1');
      expect(Debug.messages[0]).not.toContain('Message 2');

      // Last message should be "Message 52"
      expect(Debug.messages[49]).toContain('Message 52');
    });
  });

  describe('updatePanel() - DOM Updates', () => {
    it('should update debugContent with all messages joined by newlines', () => {
      Debug.log('First message');
      Debug.log('Second message');
      Debug.log('Third message', true); // Error message

      // BEHAVIORAL: Verify debugContent textContent updated
      const debugContent = mockElements['debugContent'];
      expect(debugContent.textContent).toContain('First message');
      expect(debugContent.textContent).toContain('Second message');
      expect(debugContent.textContent).toContain('Third message');

      // BEHAVIORAL: Verify messages separated by newlines
      const lines = debugContent.textContent.split('\n');
      expect(lines).toHaveLength(3);
      expect(lines[0]).toContain('✓'); // Normal message
      expect(lines[1]).toContain('✓'); // Normal message
      expect(lines[2]).toContain('❌'); // Error message
    });

    it('should auto-scroll to bottom when debug view is active', () => {
      // Set debug view as active
      global.App.viewController.currentView = 'debug';

      Debug.log('Test message');

      // BEHAVIORAL: Verify scrollTop set to scrollHeight (auto-scroll)
      const debugContent = mockElements['debugContent'];
      expect(debugContent.scrollTop).toBe(debugContent.scrollHeight);
    });

    it('should NOT auto-scroll when debug view is not active', () => {
      // Set different view as active
      global.App.viewController.currentView = 'scanner';

      Debug.log('Test message');

      // BEHAVIORAL: Verify scrollTop NOT changed (no auto-scroll)
      const debugContent = mockElements['debugContent'];
      expect(debugContent.scrollTop).toBe(0); // Unchanged from initial value
    });
  });

  describe('clear() - Message Clearing', () => {
    it('should clear all messages and update panel', () => {
      // Add some messages
      Debug.log('Message 1');
      Debug.log('Message 2');
      Debug.log('Message 3');

      expect(Debug.messages).toHaveLength(3);
      expect(mockElements['debugContent'].textContent).not.toBe('');

      // Clear messages
      Debug.clear();

      // BEHAVIORAL: Verify messages array cleared
      expect(Debug.messages).toHaveLength(0);

      // BEHAVIORAL: Verify panel cleared
      expect(mockElements['debugContent'].textContent).toBe('');
    });
  });

  describe('toggle() - View Switching', () => {
    it('should switch to debug view when not currently active', () => {
      global.App.viewController.currentView = 'scanner';

      Debug.toggle();

      // BEHAVIORAL: Verify switchView called with 'debug'
      expect(global.App.viewController.switchView).toHaveBeenCalledWith('debug');
    });

    it('should switch back to scanner view when debug is currently active', () => {
      global.App.viewController.currentView = 'debug';

      Debug.toggle();

      // BEHAVIORAL: Verify switchView called with 'scanner'
      expect(global.App.viewController.switchView).toHaveBeenCalledWith('scanner');
    });

    it('should handle missing viewController gracefully', () => {
      delete global.App.viewController;
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      Debug.toggle();

      // BEHAVIORAL: Verify warning logged
      expect(consoleWarnSpy).toHaveBeenCalledWith('Debug view not available in this mode');

      consoleWarnSpy.mockRestore();
    });
  });
});
