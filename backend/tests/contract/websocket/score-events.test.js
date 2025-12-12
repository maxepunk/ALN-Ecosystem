/**
 * Score Events - Contract Validation Tests (Server→Client Events)
 *
 * Tests that score:updated and group:completed events match AsyncAPI specification.
 * Focus: Server→Client event structure validation (pure schema tests)
 *
 * Contract: backend/contracts/asyncapi.yaml
 * Events Tested:
 *   - score:updated (broadcasts to GM stations)
 *   - group:completed (broadcasts to GM stations)
 *
 * Layer 3 (Contract): Validates event structure ONLY, NOT business logic or integration flow
 */

const { validateWebSocketEvent } = require('../../helpers/contract-validator');

describe('Score Events - Contract Validation (Server→Client)', () => {

  describe('score:updated - Team Score Broadcast', () => {

    it('should emit score:updated with wrapped envelope structure', () => {
      // Build event as orchestrator would broadcast it
      const event = {
        event: 'score:updated',
        data: {
          teamId: 'Team Alpha',
          currentScore: 150,
          baseScore: 100,
          bonusPoints: 50,
          tokensScanned: 3,
          completedGroups: ['jaw_group'],
          adminAdjustments: [],
          lastUpdate: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      };

      // Validate against AsyncAPI schema
      expect(() => {
        validateWebSocketEvent(event, 'score:updated');
      }).not.toThrow();
    });

    it('should include all required fields in data payload', () => {
      const event = {
        event: 'score:updated',
        data: {
          teamId: 'Detectives',
          currentScore: 200,
          baseScore: 150,
          bonusPoints: 50,
          tokensScanned: 5,
          completedGroups: [],
          adminAdjustments: [],
          lastUpdate: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      };

      // Validate required fields
      expect(event.data).toHaveProperty('teamId');
      expect(event.data).toHaveProperty('currentScore');
      expect(event.data).toHaveProperty('baseScore');
      expect(event.data).toHaveProperty('bonusPoints');
      expect(event.data).toHaveProperty('tokensScanned');
      expect(event.data).toHaveProperty('completedGroups');
      expect(event.data).toHaveProperty('adminAdjustments');
      expect(event.data).toHaveProperty('lastUpdate');

      // Validate against contract
      expect(() => {
        validateWebSocketEvent(event, 'score:updated');
      }).not.toThrow();
    });

    it('should accept any non-empty string for teamId (no pattern restriction)', () => {
      const event = {
        event: 'score:updated',
        data: {
          teamId: 'Whitemetal Inc.', // Any string is valid - GM types what they want
          currentScore: 100,
          baseScore: 100,
          bonusPoints: 0,
          tokensScanned: 2,
          completedGroups: [],
          adminAdjustments: [],
          lastUpdate: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      };

      // Validate against contract - no pattern restriction
      expect(() => {
        validateWebSocketEvent(event, 'score:updated');
      }).not.toThrow();
    });

    it('should accept adminAdjustments array with audit metadata', () => {
      const event = {
        event: 'score:updated',
        data: {
          teamId: 'Blue Squad',
          currentScore: 250,
          baseScore: 200,
          bonusPoints: 0,
          tokensScanned: 4,
          completedGroups: [],
          adminAdjustments: [
            {
              delta: 50,
              reason: 'Manual adjustment for lost token',
              timestamp: new Date().toISOString(),
              gmStation: 'GM_Station_1'
            }
          ],
          lastUpdate: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      };

      // Validate against contract
      expect(() => {
        validateWebSocketEvent(event, 'score:updated');
      }).not.toThrow();
    });

    it('should accept empty adminAdjustments array', () => {
      const event = {
        event: 'score:updated',
        data: {
          teamId: 'Team Alpha',
          currentScore: 100,
          baseScore: 100,
          bonusPoints: 0,
          tokensScanned: 2,
          completedGroups: [],
          adminAdjustments: [], // Empty array is valid
          lastUpdate: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      };

      // Validate against contract
      expect(() => {
        validateWebSocketEvent(event, 'score:updated');
      }).not.toThrow();
    });

    it('should accept completedGroups array with group IDs', () => {
      const event = {
        event: 'score:updated',
        data: {
          teamId: 'Team Alpha',
          currentScore: 1100,
          baseScore: 600,
          bonusPoints: 500,
          tokensScanned: 6,
          completedGroups: ['jaw_group', 'rat_group'],
          adminAdjustments: [],
          lastUpdate: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      };

      // Validate against contract
      expect(() => {
        validateWebSocketEvent(event, 'score:updated');
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
          event: 'score:updated',
          data: {
            teamId: teamId,
            currentScore: 100,
            baseScore: 100,
            bonusPoints: 0,
            tokensScanned: 2,
            completedGroups: [],
            adminAdjustments: [],
            lastUpdate: new Date().toISOString()
          },
          timestamp: new Date().toISOString()
        };

        expect(() => {
          validateWebSocketEvent(event, 'score:updated');
        }).not.toThrow();
      });
    });

    it('should format lastUpdate and timestamp as ISO8601 date-time', () => {
      const timestamp = new Date().toISOString();
      const event = {
        event: 'score:updated',
        data: {
          teamId: 'Team Alpha',
          currentScore: 100,
          baseScore: 100,
          bonusPoints: 0,
          tokensScanned: 2,
          completedGroups: [],
          adminAdjustments: [],
          lastUpdate: timestamp
        },
        timestamp: timestamp
      };

      // Verify format
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

      // Validate against contract
      expect(() => {
        validateWebSocketEvent(event, 'score:updated');
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
          event: 'score:updated',
          data: {
            teamId: 'Team Alpha',
            currentScore: 150,
            baseScore: 100,
            bonusPoints: 50,
            tokensScanned: 3,
            completedGroups: [],
            adminAdjustments: [],
            lastUpdate: new Date().toISOString()
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
        currentScore: 150,
        baseScore: 100,
        bonusPoints: 50
      };

      expect(() => {
        validateWebSocketEvent(unwrappedEvent, 'score:updated');
      }).toThrow(/required/i);
    });

    it('should reject events missing timestamp', () => {
      const event = {
        event: 'score:updated',
        data: {
          teamId: 'Team Alpha',
          currentScore: 100,
          baseScore: 100,
          bonusPoints: 0,
          tokensScanned: 2,
          completedGroups: [],
          adminAdjustments: [],
          lastUpdate: new Date().toISOString()
        }
        // missing timestamp
      };

      expect(() => {
        validateWebSocketEvent(event, 'score:updated');
      }).toThrow(/required/i);
    });
  });
});
