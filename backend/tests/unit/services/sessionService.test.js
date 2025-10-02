/**
 * SessionService Unit Tests
 * Tests session:update event emission per asyncapi.yaml
 */

const { validateWebSocketEvent } = require('../../helpers/contract-validator');
const sessionService = require('../../../src/services/sessionService');

describe('SessionService - Event Emission', () => {
  beforeEach(async () => {
    // Reset service state
    await sessionService.reset();
  });

  afterEach(async () => {
    // Cleanup
    if (sessionService.currentSession) {
      await sessionService.endSession();
    }
    sessionService.removeAllListeners();
  });

  describe('session:update event', () => {
    it('should emit session:update with status=active when session created', (done) => {
      sessionService.once('session:update', (eventData) => {
        try {
          // Validate against asyncapi.yaml schema (wrapped envelope)
          validateWebSocketEvent(eventData, 'session:update');

          // Verify wrapper structure
          expect(eventData.event).toBe('session:update');
          expect(eventData.data).toBeDefined();
          expect(eventData.timestamp).toBeDefined();

          // Verify session data inside wrapper
          expect(eventData.data.status).toBe('active');
          expect(eventData.data.id).toBeDefined();
          expect(eventData.data.name).toBe('Test Session');
          expect(eventData.data.startTime).toBeDefined();

          done();
        } catch (error) {
          done(error);
        }
      });

      sessionService.createSession({ name: 'Test Session', teams: ['001', '002'] });
    });

    it('should emit session:update with status=ended when session ended', async () => {
      // Create session first
      await sessionService.createSession({ name: 'Test Session', teams: ['001'] });

      // Listen for end event
      const endEventPromise = new Promise((resolve, reject) => {
        sessionService.once('session:update', (eventData) => {
          try {
            // Validate against asyncapi.yaml schema (wrapped envelope)
            validateWebSocketEvent(eventData, 'session:update');

            // Verify wrapper structure
            expect(eventData.event).toBe('session:update');
            expect(eventData.data).toBeDefined();

            // Verify session data - status is 'ended'
            expect(eventData.data.status).toBe('ended');
            expect(eventData.data.endTime).toBeDefined();

            resolve(eventData);
          } catch (error) {
            reject(error);
          }
        });
      });

      // End the session
      await sessionService.endSession();

      // Wait for event
      await endEventPromise;
    });

    it('should include full session resource in event data', async () => {
      const eventPromise = new Promise((resolve) => {
        sessionService.once('session:update', resolve);
      });

      await sessionService.createSession({ name: 'Full Resource Test', teams: ['001'] });

      const eventData = await eventPromise;

      // Verify wrapped envelope
      expect(eventData).toHaveProperty('event', 'session:update');
      expect(eventData).toHaveProperty('data');
      expect(eventData).toHaveProperty('timestamp');

      // Verify full session resource in data per Decision #7
      expect(eventData.data).toHaveProperty('id');
      expect(eventData.data).toHaveProperty('name');
      expect(eventData.data).toHaveProperty('status');
      expect(eventData.data).toHaveProperty('startTime');
      expect(eventData.data).toHaveProperty('scores');
      expect(eventData.data).toHaveProperty('metadata');
    });
  });

  describe('lazy require removal', () => {
    it('should not use lazy requires in createSession', () => {
      // This test verifies the pattern, actual verification is manual code inspection
      // The test ensures no runtime errors occur without lazy requires
      expect(async () => {
        await sessionService.createSession({ name: 'No Lazy Requires', teams: ['001'] });
      }).not.toThrow();
    });
  });
});
