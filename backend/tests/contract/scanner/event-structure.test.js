/**
 * GM Scanner - AsyncAPI Contract Compliance Tests (Outbound Events)
 *
 * Tests that events SENT by GM Scanner match AsyncAPI specification.
 * Focus: Client→Server event structure validation
 *
 * Contract: backend/contracts/asyncapi.yaml
 * Events Tested:
 *   - transaction:submit (GM submits token scan)
 *   - gm:command (Admin panel commands)
 */

const { validateWebSocketEvent } = require('../../helpers/contract-validator');

describe('GM Scanner - Outbound Event Structure (AsyncAPI Contract)', () => {

  describe('transaction:submit - Token Scan Submission', () => {

    it('should emit transaction:submit with wrapped envelope structure', () => {
      // Build event as GM scanner would
      const event = {
        event: 'transaction:submit',
        data: {
          tokenId: '534e2b03',
          teamId: 'Team Alpha',
          deviceId: 'GM_Station_1',
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      };

      // Validate against AsyncAPI schema
      expect(() => {
        validateWebSocketEvent(event, 'transaction:submit');
      }).not.toThrow();
    });

    it('should include all required fields in data payload', () => {
      const event = {
        event: 'transaction:submit',
        data: {
          tokenId: 'test_token',
          teamId: 'Detectives',
          deviceId: 'GM_Station_2',
          mode: 'detective'
        },
        timestamp: new Date().toISOString()
      };

      // Validate required fields
      expect(event.data).toHaveProperty('tokenId');
      expect(event.data).toHaveProperty('teamId');
      expect(event.data).toHaveProperty('deviceId');
      expect(event.data).toHaveProperty('mode');

      // Validate against contract
      expect(() => {
        validateWebSocketEvent(event, 'transaction:submit');
      }).not.toThrow();
    });

    it('should accept any non-empty string for teamId (no pattern restriction)', () => {
      const event = {
        event: 'transaction:submit',
        data: {
          tokenId: 'token123',
          teamId: 'Whitemetal Inc.', // Any string is valid - GM types what they want
          deviceId: 'GM_Station_1',
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      };

      // Validate against contract - no pattern restriction
      expect(() => {
        validateWebSocketEvent(event, 'transaction:submit');
      }).not.toThrow();
    });

    it('should accept both detective and blackmarket modes', () => {
      const modes = ['detective', 'blackmarket'];

      modes.forEach(mode => {
        const event = {
          event: 'transaction:submit',
          data: {
            tokenId: 'token_test',
            teamId: 'Blue Squad',
            deviceId: 'GM_Station_1',
            mode: mode
          },
          timestamp: new Date().toISOString()
        };

        expect(() => {
          validateWebSocketEvent(event, 'transaction:submit');
        }).not.toThrow();
      });
    });

    it('should accept special characters in teamId (no pattern restriction)', () => {
      // These were previously rejected - now they're all valid
      const validTeamIds = [
        'Whitemetal Inc.',                   // Period is valid
        "O'Brien & Co.",                     // Apostrophe and ampersand valid
        'Team@Special',                      // @ is valid
        'Team#123',                          // # is valid
        'Team!Name'                          // ! is valid
      ];

      validTeamIds.forEach(teamId => {
        const event = {
          event: 'transaction:submit',
          data: {
            tokenId: 'token_test',
            teamId: teamId,
            deviceId: 'GM_Station_1',
            mode: 'blackmarket'
          },
          timestamp: new Date().toISOString()
        };

        expect(() => {
          validateWebSocketEvent(event, 'transaction:submit');
        }).not.toThrow();
      });
    });

    it('should reject invalid mode values', () => {
      const event = {
        event: 'transaction:submit',
        data: {
          tokenId: 'token_test',
          teamId: 'Team Alpha',
          deviceId: 'GM_Station_1',
          mode: 'invalid_mode' // Not in enum
        },
        timestamp: new Date().toISOString()
      };

      expect(() => {
        validateWebSocketEvent(event, 'transaction:submit');
      }).toThrow();
    });

    it('should format timestamp as ISO8601 date-time', () => {
      const timestamp = new Date().toISOString();
      const event = {
        event: 'transaction:submit',
        data: {
          tokenId: 'token_test',
          teamId: 'Team Alpha',
          deviceId: 'GM_Station_1',
          mode: 'blackmarket'
        },
        timestamp: timestamp
      };

      // Verify format
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

      // Validate against contract
      expect(() => {
        validateWebSocketEvent(event, 'transaction:submit');
      }).not.toThrow();
    });
  });

  describe('gm:command - Admin Panel Commands', () => {

    it('should emit gm:command with wrapped envelope structure', () => {
      const event = {
        event: 'gm:command',
        data: {
          action: 'video:skip',
          payload: {}
        },
        timestamp: new Date().toISOString()
      };

      // Validate against AsyncAPI schema
      expect(() => {
        validateWebSocketEvent(event, 'gm:command');
      }).not.toThrow();
    });

    it('should support all session management actions', () => {
      const sessionActions = [
        'session:create',
        'session:pause',
        'session:resume',
        'session:end'
      ];

      sessionActions.forEach(action => {
        const event = {
          event: 'gm:command',
          data: {
            action: action,
            payload: action === 'session:create'
              ? { name: 'Test Session', teams: ['Team Alpha'] }
              : {}
          },
          timestamp: new Date().toISOString()
        };

        expect(() => {
          validateWebSocketEvent(event, 'gm:command');
        }).not.toThrow();
      });
    });

    it('should support all video control actions', () => {
      const videoActions = [
        'video:play',
        'video:pause',
        'video:stop',
        'video:skip',
        'video:queue:add',
        'video:queue:reorder',
        'video:queue:clear'
      ];

      videoActions.forEach(action => {
        const event = {
          event: 'gm:command',
          data: {
            action: action,
            payload: action === 'video:queue:add'
              ? { filename: 'jaw001.mp4' }
              : {}
          },
          timestamp: new Date().toISOString()
        };

        expect(() => {
          validateWebSocketEvent(event, 'gm:command');
        }).not.toThrow();
      });
    });

    it('should support score and transaction actions', () => {
      const dataActions = [
        { action: 'score:adjust', payload: { teamId: 'Team Alpha', delta: -500, reason: 'Test' } },
        { action: 'transaction:delete', payload: { transactionId: 'uuid-here' } },
        { action: 'transaction:create', payload: { tokenId: 'test', teamId: 'Team Alpha' } }
      ];

      dataActions.forEach(({ action, payload }) => {
        const event = {
          event: 'gm:command',
          data: { action, payload },
          timestamp: new Date().toISOString()
        };

        expect(() => {
          validateWebSocketEvent(event, 'gm:command');
        }).not.toThrow();
      });
    });

    it('should support system:reset action', () => {
      const event = {
        event: 'gm:command',
        data: {
          action: 'system:reset',
          payload: {}
        },
        timestamp: new Date().toISOString()
      };

      expect(() => {
        validateWebSocketEvent(event, 'gm:command');
      }).not.toThrow();
    });

    it('should reject invalid action values', () => {
      const event = {
        event: 'gm:command',
        data: {
          action: 'invalid:action',
          payload: {}
        },
        timestamp: new Date().toISOString()
      };

      expect(() => {
        validateWebSocketEvent(event, 'gm:command');
      }).toThrow();
    });

    it('should require payload field even if empty object', () => {
      const eventWithPayload = {
        event: 'gm:command',
        data: {
          action: 'video:skip',
          payload: {}
        },
        timestamp: new Date().toISOString()
      };

      // Valid with empty payload
      expect(() => {
        validateWebSocketEvent(eventWithPayload, 'gm:command');
      }).not.toThrow();

      // Invalid without payload field
      const eventWithoutPayload = {
        event: 'gm:command',
        data: {
          action: 'video:skip'
          // missing payload
        },
        timestamp: new Date().toISOString()
      };

      expect(() => {
        validateWebSocketEvent(eventWithoutPayload, 'gm:command');
      }).toThrow(/required/i);
    });
  });

  describe('Wrapped Envelope Pattern (Decision #2)', () => {

    it('should wrap all events with {event, data, timestamp} structure', () => {
      const events = [
        {
          event: 'transaction:submit',
          data: {
            tokenId: 'test', teamId: 'Team Alpha',
            deviceId: 'GM_1', mode: 'blackmarket'
          },
          timestamp: new Date().toISOString()
        },
        {
          event: 'gm:command',
          data: { action: 'video:skip', payload: {} },
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
        tokenId: 'test',
        teamId: 'Team Alpha',
        deviceId: 'GM_1',
        mode: 'blackmarket'
      };

      expect(() => {
        validateWebSocketEvent(unwrappedEvent, 'transaction:submit');
      }).toThrow(/required/i);
    });

    it('should reject events missing timestamp', () => {
      const event = {
        event: 'transaction:submit',
        data: {
          tokenId: 'test', teamId: 'Team Alpha',
          deviceId: 'GM_1', mode: 'blackmarket'
        }
        // missing timestamp
      };

      expect(() => {
        validateWebSocketEvent(event, 'transaction:submit');
      }).toThrow(/required/i);
    });
  });

  describe('Field Naming Conventions (Decision #4)', () => {

    it('should use tokenId (not rfid or token_id)', () => {
      const event = {
        event: 'transaction:submit',
        data: {
          tokenId: '534e2b03',  // Correct field name
          teamId: 'Team Alpha',
          deviceId: 'GM_Station_1',
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      };

      expect(() => {
        validateWebSocketEvent(event, 'transaction:submit');
      }).not.toThrow();
    });

    it('should use deviceId (not device_id or stationId)', () => {
      const event = {
        event: 'transaction:submit',
        data: {
          tokenId: 'test',
          teamId: 'Team Alpha',
          deviceId: 'GM_Station_1',  // Correct field name
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      };

      expect(() => {
        validateWebSocketEvent(event, 'transaction:submit');
      }).not.toThrow();
    });
  });
});
