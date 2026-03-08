/**
 * Score Events - Contract Validation Tests (Server→Client Events)
 *
 * Tests that score:adjusted and group:completed events match AsyncAPI specification.
 * Focus: Server→Client event structure validation (pure schema tests)
 *
 * Contract: backend/contracts/asyncapi.yaml
 * Events Tested:
 *   - score:adjusted (broadcasts to session room for admin adjustments)
 *   - group:completed (broadcasts to GM stations)
 *
 * Note: score:updated was removed — scores now delivered via
 * transaction:new.teamScore (normal transactions) and score:adjusted (admin).
 *
 * Layer 3 (Contract): Validates event structure ONLY, NOT business logic or integration flow
 */

const { validateWebSocketEvent } = require('../../helpers/contract-validator');

describe('Score Events - Contract Validation (Server→Client)', () => {

  describe('score:adjusted - Admin Score Adjustment Broadcast', () => {

    it('should emit score:adjusted with wrapped envelope structure', () => {
      const event = {
        event: 'score:adjusted',
        data: {
          teamScore: {
            teamId: 'Team Alpha',
            currentScore: 150,
            baseScore: 100,
            bonusPoints: 50,
            tokensScanned: 3,
            completedGroups: ['jaw_group'],
            adminAdjustments: [{ delta: 50, reason: 'bonus' }],
            lastUpdate: new Date().toISOString()
          }
        },
        timestamp: new Date().toISOString()
      };

      // Validate against AsyncAPI schema
      expect(() => {
        validateWebSocketEvent(event, 'score:adjusted');
      }).not.toThrow();
    });

    it('should include teamScore with all required fields', () => {
      const event = {
        event: 'score:adjusted',
        data: {
          teamScore: {
            teamId: 'Detectives',
            currentScore: 200,
            baseScore: 150,
            bonusPoints: 50,
            tokensScanned: 5,
            completedGroups: [],
            adminAdjustments: [{ delta: 200, reason: 'manual' }],
            lastUpdate: new Date().toISOString()
          }
        },
        timestamp: new Date().toISOString()
      };

      // Validate required fields on teamScore
      expect(event.data.teamScore).toHaveProperty('teamId');
      expect(event.data.teamScore).toHaveProperty('currentScore');
      expect(event.data.teamScore).toHaveProperty('baseScore');
      expect(event.data.teamScore).toHaveProperty('bonusPoints');
      expect(event.data.teamScore).toHaveProperty('tokensScanned');
      expect(event.data.teamScore).toHaveProperty('completedGroups');
      expect(event.data.teamScore).toHaveProperty('adminAdjustments');
      expect(event.data.teamScore).toHaveProperty('lastUpdate');

      // Validate against contract
      expect(() => {
        validateWebSocketEvent(event, 'score:adjusted');
      }).not.toThrow();
    });
  });

  describe('group:completed - Group Completion Broadcast', () => {

    it('should emit group:completed with wrapped envelope structure', () => {
      // Build event as orchestrator would broadcast it
      const event = {
        event: 'group:completed',
        data: {
          teamId: 'Team Alpha',
          group: 'jaw_group',
          bonusPoints: 500,
          completedAt: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      };

      // Validate against AsyncAPI schema
      expect(() => {
        validateWebSocketEvent(event, 'group:completed');
      }).not.toThrow();
    });

    it('should include all required fields in data payload', () => {
      const event = {
        event: 'group:completed',
        data: {
          teamId: 'Detectives',
          group: 'rat_group',
          bonusPoints: 500,
          completedAt: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      };

      // Validate required fields
      expect(event.data).toHaveProperty('teamId');
      expect(event.data).toHaveProperty('group');
      expect(event.data).toHaveProperty('bonusPoints');
      expect(event.data).toHaveProperty('completedAt');

      // Validate against contract
      expect(() => {
        validateWebSocketEvent(event, 'group:completed');
      }).not.toThrow();
    });

    it('should accept any non-empty string for teamId (no pattern restriction)', () => {
      const event = {
        event: 'group:completed',
        data: {
          teamId: 'Whitemetal Inc.', // Any string is valid - GM types what they want
          group: 'mab_group',
          bonusPoints: 500,
          completedAt: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      };

      // Validate against contract - no pattern restriction
      expect(() => {
        validateWebSocketEvent(event, 'group:completed');
      }).not.toThrow();
    });

    it('should use group field name (not groupId)', () => {
      const event = {
        event: 'group:completed',
        data: {
          teamId: 'Team Alpha',
          group: 'jaw_group',  // Correct field name per AsyncAPI
          bonusPoints: 500,
          completedAt: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      };

      // Validate has 'group' field
      expect(event.data).toHaveProperty('group');
      expect(event.data).not.toHaveProperty('groupId');

      // Validate against contract
      expect(() => {
        validateWebSocketEvent(event, 'group:completed');
      }).not.toThrow();
    });

    it('should use bonusPoints field name (not bonus)', () => {
      const event = {
        event: 'group:completed',
        data: {
          teamId: 'Team Alpha',
          group: 'jaw_group',
          bonusPoints: 500,  // Correct field name per AsyncAPI
          completedAt: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      };

      // Validate has 'bonusPoints' field
      expect(event.data).toHaveProperty('bonusPoints');
      expect(event.data).not.toHaveProperty('bonus');

      // Validate against contract
      expect(() => {
        validateWebSocketEvent(event, 'group:completed');
      }).not.toThrow();
    });

    it('should accept special characters in teamId (no pattern restriction)', () => {
      // These were previously rejected - now they're all valid
      const validTeamIds = [
        'Whitemetal Inc.',           // Period is valid
        "O'Brien & Co.",             // Apostrophe and ampersand valid
        'Team@Special',              // @ is valid
        'Team#123',                  // # is valid
        'Team!Name'                  // ! is valid
      ];

      validTeamIds.forEach(teamId => {
        const event = {
          event: 'group:completed',
          data: {
            teamId: teamId,
            group: 'test_group',
            bonusPoints: 500,
            completedAt: new Date().toISOString()
          },
          timestamp: new Date().toISOString()
        };

        expect(() => {
          validateWebSocketEvent(event, 'group:completed');
        }).not.toThrow();
      });
    });

    it('should format completedAt and timestamp as ISO8601 date-time', () => {
      const timestamp = new Date().toISOString();
      const event = {
        event: 'group:completed',
        data: {
          teamId: 'Team Alpha',
          group: 'jaw_group',
          bonusPoints: 500,
          completedAt: timestamp
        },
        timestamp: timestamp
      };

      // Verify format
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

      // Validate against contract
      expect(() => {
        validateWebSocketEvent(event, 'group:completed');
      }).not.toThrow();
    });
  });

  describe('Wrapped Envelope Pattern (Decision #2)', () => {

    it('should wrap all events with {event, data, timestamp} structure', () => {
      const events = [
        {
          event: 'score:adjusted',
          data: {
            teamScore: {
              teamId: 'Team Alpha',
              currentScore: 150,
              baseScore: 100,
              bonusPoints: 50,
              tokensScanned: 3,
              completedGroups: [],
              adminAdjustments: [{ delta: 50, reason: 'bonus' }],
              lastUpdate: new Date().toISOString()
            }
          },
          timestamp: new Date().toISOString()
        },
        {
          event: 'group:completed',
          data: {
            teamId: 'Team Alpha',
            group: 'jaw_group',
            bonusPoints: 500,
            completedAt: new Date().toISOString()
          },
          timestamp: new Date().toISOString()
        }
      ];

      events.forEach(evt => {
        // Verify envelope structure
        expect(evt).toHaveProperty('event');
        expect(evt).toHaveProperty('data');
        expect(evt).toHaveProperty('timestamp');

        // Validate types
        expect(typeof evt.event).toBe('string');
        expect(typeof evt.data).toBe('object');
        expect(typeof evt.timestamp).toBe('string');
      });
    });

    it('should reject events without wrapped envelope', () => {
      // Unwrapped payload (old pattern)
      const unwrappedEvent = {
        teamId: 'Team Alpha',
        group: 'jaw_group',
        bonusPoints: 500
      };

      expect(() => {
        validateWebSocketEvent(unwrappedEvent, 'group:completed');
      }).toThrow(/required/i);
    });

    it('should reject events missing timestamp', () => {
      const event = {
        event: 'group:completed',
        data: {
          teamId: 'Team Alpha',
          group: 'jaw_group',
          bonusPoints: 500,
          completedAt: new Date().toISOString()
        }
        // missing timestamp
      };

      expect(() => {
        validateWebSocketEvent(event, 'group:completed');
      }).toThrow(/required/i);
    });
  });
});
