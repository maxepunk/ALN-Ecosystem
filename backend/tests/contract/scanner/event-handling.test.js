/**
 * GM Scanner - AsyncAPI Contract Compliance Tests (Inbound Events)
 *
 * Tests that GM Scanner correctly HANDLES events received from orchestrator.
 * Focus: Server→Client event schema validation
 *
 * Contract: backend/contracts/asyncapi.yaml
 * Events Tested:
 *   - device:connected
 *   - device:disconnected
 *   - sync:full
 *   - transaction:result
 *   - transaction:new
 *   - score:updated
 *   - video:status
 *   - session:update
 *   - gm:command:ack
 *   - offline:queue:processed
 *   - group:completed
 *   - error
 */

const { validateWebSocketEvent } = require('../../helpers/contract-validator');

describe('GM Scanner - Inbound Event Handling (AsyncAPI Contract)', () => {

  describe('device:connected - Device Connection Broadcast', () => {

    it('should validate device:connected event structure', () => {
      const event = {
        event: 'device:connected',
        data: {
          deviceId: 'GM_Station_2',
          type: 'gm',
          name: 'GM Station v1.0.0',
          ipAddress: '10.0.0.82',
          connectionTime: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      };

      // Validate against AsyncAPI schema
      expect(() => {
        validateWebSocketEvent(event, 'device:connected');
      }).not.toThrow();
    });

    it('should handle gm device type', () => {
      const event = {
        event: 'device:connected',
        data: {
          deviceId: 'GM_Station_1',
          type: 'gm',
          name: 'GM Station',
          ipAddress: '10.0.0.81',
          connectionTime: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      };

      expect(() => {
        validateWebSocketEvent(event, 'device:connected');
      }).not.toThrow();
    });

    it('should handle player device type', () => {
      const event = {
        event: 'device:connected',
        data: {
          deviceId: 'PLAYER_001',
          type: 'player',
          name: 'Player Scanner',
          ipAddress: '10.0.0.100',
          connectionTime: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      };

      expect(() => {
        validateWebSocketEvent(event, 'device:connected');
      }).not.toThrow();
    });

    it('should reject invalid device types', () => {
      const event = {
        event: 'device:connected',
        data: {
          deviceId: 'TEST',
          type: 'invalid',
          name: 'Test',
          ipAddress: '10.0.0.1',
          connectionTime: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      };

      expect(() => {
        validateWebSocketEvent(event, 'device:connected');
      }).toThrow();
    });
  });

  describe('device:disconnected - Device Disconnection Broadcast', () => {

    it('should validate device:disconnected event structure', () => {
      const event = {
        event: 'device:disconnected',
        data: {
          deviceId: 'GM_Station_2',
          reason: 'timeout',
          disconnectionTime: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      };

      expect(() => {
        validateWebSocketEvent(event, 'device:disconnected');
      }).not.toThrow();
    });

    it('should support all disconnect reasons', () => {
      const reasons = ['manual', 'timeout', 'error'];

      reasons.forEach(reason => {
        const event = {
          event: 'device:disconnected',
          data: {
            deviceId: 'GM_Station_1',
            reason: reason,
            disconnectionTime: new Date().toISOString()
          },
          timestamp: new Date().toISOString()
        };

        expect(() => {
          validateWebSocketEvent(event, 'device:disconnected');
        }).not.toThrow();
      });
    });
  });

  describe('sync:full - Complete State Synchronization', () => {

    it('should validate sync:full event with active session', () => {
      const event = {
        event: 'sync:full',
        data: {
          session: {
            id: '2a2f9d45-5d2d-441d-b32c-52c939f3c103',
            name: 'About Last Night - Test',
            startTime: new Date().toISOString(),
            endTime: null,
            status: 'active',
            teams: ['001', '002'],
            metadata: { totalScans: 10 }
          },
          scores: [
            {
              teamId: '001',
              currentScore: 5000,
              baseScore: 4500,
              bonusPoints: 500,
              tokensScanned: 5,
              completedGroups: ['jaw_group'],
              adminAdjustments: [],
              lastUpdate: new Date().toISOString()
            }
          ],
          recentTransactions: [],
          videoStatus: {
            status: 'idle',
            queueLength: 0
          },
          devices: [],
          systemStatus: {
            orchestrator: 'online',
            vlc: 'connected'
          }
        },
        timestamp: new Date().toISOString()
      };

      expect(() => {
        validateWebSocketEvent(event, 'sync:full');
      }).not.toThrow();
    });

    it('should validate sync:full with null session (no active session)', () => {
      const event = {
        event: 'sync:full',
        data: {
          session: null,
          scores: [],
          recentTransactions: [],
          videoStatus: {
            status: 'idle',
            queueLength: 0
          },
          devices: [],
          systemStatus: {
            orchestrator: 'online',
            vlc: 'disconnected'
          }
        },
        timestamp: new Date().toISOString()
      };

      expect(() => {
        validateWebSocketEvent(event, 'sync:full');
      }).not.toThrow();
    });

    it('should validate all session statuses', () => {
      const statuses = ['active', 'paused', 'ended'];

      statuses.forEach(status => {
        const event = {
          event: 'sync:full',
          data: {
            session: {
              id: '2a2f9d45-5d2d-441d-b32c-52c939f3c103',
              name: 'Test',
              startTime: new Date().toISOString(),
              endTime: status === 'ended' ? new Date().toISOString() : null,
              status: status,
              teams: ['001'],
              metadata: {}
            },
            scores: [],
            recentTransactions: [],
            videoStatus: { status: 'idle', queueLength: 0 },
            devices: [],
            systemStatus: { orchestrator: 'online', vlc: 'connected' }
          },
          timestamp: new Date().toISOString()
        };

        expect(() => {
          validateWebSocketEvent(event, 'sync:full');
        }).not.toThrow();
      });
    });

    it('should validate all video statuses', () => {
      const statuses = ['idle', 'loading', 'playing', 'paused', 'completed', 'error'];

      statuses.forEach(videoStatus => {
        const event = {
          event: 'sync:full',
          data: {
            session: null,
            scores: [],
            recentTransactions: [],
            videoStatus: {
              status: videoStatus,
              queueLength: 2,
              tokenId: videoStatus === 'playing' ? 'test_token' : null,
              duration: videoStatus === 'playing' ? 30 : null,
              progress: videoStatus === 'playing' ? 50 : null,
              expectedEndTime: null,
              error: videoStatus === 'error' ? 'Test error' : null
            },
            devices: [],
            systemStatus: { orchestrator: 'online', vlc: 'connected' }
          },
          timestamp: new Date().toISOString()
        };

        expect(() => {
          validateWebSocketEvent(event, 'sync:full');
        }).not.toThrow();
      });
    });
  });

  describe('transaction:result - Transaction Processing Result', () => {

    it('should validate accepted transaction result', () => {
      const event = {
        event: 'transaction:result',
        data: {
          status: 'accepted',
          transactionId: '7b8b1d85-b234-4be9-bde5-4c8522a1f15e',
          tokenId: '534e2b03',
          teamId: '001',
          points: 3000,
          message: 'Transaction accepted - 3000 points awarded',
          error: null
        },
        timestamp: new Date().toISOString()
      };

      expect(() => {
        validateWebSocketEvent(event, 'transaction:result');
      }).not.toThrow();
    });

    it('should validate duplicate transaction result', () => {
      const event = {
        event: 'transaction:result',
        data: {
          status: 'duplicate',
          transactionId: '7b8b1d85-b234-4be9-bde5-4c8522a1f15e',
          tokenId: '534e2b03',
          teamId: '001',
          points: 0,
          message: 'Token already scanned',
          error: null
        },
        timestamp: new Date().toISOString()
      };

      expect(() => {
        validateWebSocketEvent(event, 'transaction:result');
      }).not.toThrow();
    });

    it('should validate error transaction result', () => {
      const event = {
        event: 'transaction:result',
        data: {
          status: 'error',
          transactionId: '7b8b1d85-b234-4be9-bde5-4c8522a1f15e',
          tokenId: 'unknown',
          teamId: '001',
          points: 0,
          message: 'Token not found',
          error: 'TOKEN_NOT_FOUND'
        },
        timestamp: new Date().toISOString()
      };

      expect(() => {
        validateWebSocketEvent(event, 'transaction:result');
      }).not.toThrow();
    });
  });

  describe('transaction:new - New Transaction Broadcast', () => {

    it('should validate transaction:new event structure', () => {
      const event = {
        event: 'transaction:new',
        data: {
          transaction: {
            id: '7b8b1d85-b234-4be9-bde5-4c8522a1f15e',
            tokenId: '534e2b03',
            teamId: '001',
            deviceId: 'GM_Station_1',
            mode: 'blackmarket',
            points: 3000,
            timestamp: new Date().toISOString(),
            memoryType: 'Technical',
            valueRating: 3,
            group: 'jaw_group'
          }
        },
        timestamp: new Date().toISOString()
      };

      expect(() => {
        validateWebSocketEvent(event, 'transaction:new');
      }).not.toThrow();
    });

    it('should validate all memory types', () => {
      const memoryTypes = ['Technical', 'Business', 'Personal'];

      memoryTypes.forEach(memoryType => {
        const event = {
          event: 'transaction:new',
          data: {
            transaction: {
              id: '7b8b1d85-b234-4be9-bde5-4c8522a1f15e',
              tokenId: 'test',
              teamId: '001',
              deviceId: 'GM_1',
              mode: 'blackmarket',
              points: 1000,
              timestamp: new Date().toISOString(),
              memoryType: memoryType,
              valueRating: 2,
              group: 'test_group'
            }
          },
          timestamp: new Date().toISOString()
        };

        expect(() => {
          validateWebSocketEvent(event, 'transaction:new');
        }).not.toThrow();
      });
    });

    it('should validate value ratings 1-5', () => {
      for (let rating = 1; rating <= 5; rating++) {
        const event = {
          event: 'transaction:new',
          data: {
            transaction: {
              id: '7b8b1d85-b234-4be9-bde5-4c8522a1f15e',
              tokenId: 'test',
              teamId: '001',
              deviceId: 'GM_1',
              mode: 'detective',
              points: rating * 100,
              timestamp: new Date().toISOString(),
              memoryType: 'Technical',
              valueRating: rating,
              group: 'test'
            }
          },
          timestamp: new Date().toISOString()
        };

        expect(() => {
          validateWebSocketEvent(event, 'transaction:new');
        }).not.toThrow();
      }
    });
  });

  describe('score:updated - Team Score Update Broadcast', () => {

    it('should validate score:updated event with all 8 required fields', () => {
      const event = {
        event: 'score:updated',
        data: {
          teamId: '001',
          currentScore: 11500,
          baseScore: 11000,
          bonusPoints: 500,
          tokensScanned: 8,
          completedGroups: ['jaw_group'],
          adminAdjustments: [],
          lastUpdate: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      };

      // Verify all 8 fields present (contract requirement)
      expect(event.data).toHaveProperty('teamId');
      expect(event.data).toHaveProperty('currentScore');
      expect(event.data).toHaveProperty('baseScore');
      expect(event.data).toHaveProperty('bonusPoints');
      expect(event.data).toHaveProperty('tokensScanned');
      expect(event.data).toHaveProperty('completedGroups');
      expect(event.data).toHaveProperty('adminAdjustments');
      expect(event.data).toHaveProperty('lastUpdate');

      expect(() => {
        validateWebSocketEvent(event, 'score:updated');
      }).not.toThrow();
    });

    it('should validate empty completedGroups array', () => {
      const event = {
        event: 'score:updated',
        data: {
          teamId: '002',
          currentScore: 1000,
          baseScore: 1000,
          bonusPoints: 0,
          tokensScanned: 2,
          completedGroups: [], // No completions yet
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

  describe('video:status - Video Playback Status Broadcast', () => {

    it('should validate video:status with queueLength field (Decision #5)', () => {
      const event = {
        event: 'video:status',
        data: {
          status: 'playing',
          queueLength: 2, // REQUIRED field per Decision #5
          tokenId: '534e2b03',
          duration: 30,
          progress: 45,
          expectedEndTime: new Date(Date.now() + 30000).toISOString(),
          error: null
        },
        timestamp: new Date().toISOString()
      };

      expect(() => {
        validateWebSocketEvent(event, 'video:status');
      }).not.toThrow();
    });

    it('should validate all video status values', () => {
      const statuses = ['idle', 'loading', 'playing', 'paused', 'completed', 'error'];

      statuses.forEach(status => {
        const event = {
          event: 'video:status',
          data: {
            status: status,
            queueLength: 1,
            tokenId: status === 'idle' ? null : 'test',
            duration: null,
            progress: null,
            expectedEndTime: null,
            error: status === 'error' ? 'Test error' : null
          },
          timestamp: new Date().toISOString()
        };

        expect(() => {
          validateWebSocketEvent(event, 'video:status');
        }).not.toThrow();
      });
    });
  });

  describe('session:update - Session State Change Broadcast', () => {

    it('should validate session:update with full resource (Decision #7)', () => {
      const event = {
        event: 'session:update',
        data: {
          id: '2a2f9d45-5d2d-441d-b32c-52c939f3c103',
          name: 'About Last Night - Test',
          startTime: new Date().toISOString(),
          endTime: null,
          status: 'active',
          teams: ['001', '002', '003'],
          metadata: {
            gmStations: 2,
            playerDevices: 3,
            totalScans: 47
          }
        },
        timestamp: new Date().toISOString()
      };

      expect(() => {
        validateWebSocketEvent(event, 'session:update');
      }).not.toThrow();
    });

    it('should use id field not sessionId (Decision #4)', () => {
      const event = {
        event: 'session:update',
        data: {
          id: '2a2f9d45-5d2d-441d-b32c-52c939f3c103', // Use 'id', not 'sessionId'
          name: 'Test',
          startTime: new Date().toISOString(),
          endTime: null,
          status: 'active',
          teams: ['001'],
          metadata: {}
        },
        timestamp: new Date().toISOString()
      };

      // Verify field name
      expect(event.data).toHaveProperty('id');
      expect(event.data).not.toHaveProperty('sessionId');

      expect(() => {
        validateWebSocketEvent(event, 'session:update');
      }).not.toThrow();
    });
  });

  describe('gm:command:ack - Command Acknowledgment', () => {

    it('should validate successful command acknowledgment', () => {
      const event = {
        event: 'gm:command:ack',
        data: {
          action: 'video:skip',
          success: true,
          message: 'Video skipped successfully',
          error: null,
          result: null
        },
        timestamp: new Date().toISOString()
      };

      expect(() => {
        validateWebSocketEvent(event, 'gm:command:ack');
      }).not.toThrow();
    });

    it('should validate failed command acknowledgment', () => {
      const event = {
        event: 'gm:command:ack',
        data: {
          action: 'video:play',
          success: false,
          message: 'No video in queue',
          error: 'QUEUE_EMPTY',
          result: null
        },
        timestamp: new Date().toISOString()
      };

      expect(() => {
        validateWebSocketEvent(event, 'gm:command:ack');
      }).not.toThrow();
    });
  });

  describe('offline:queue:processed - Offline Queue Processing Complete', () => {

    it('should validate offline:queue:processed event', () => {
      const event = {
        event: 'offline:queue:processed',
        data: {
          queueSize: 5,
          results: [
            {
              transactionId: '7b8b1d85-b234-4be9-bde5-4c8522a1f15e',
              status: 'processed',
              error: null
            },
            {
              transactionId: '8c9c2e96-c345-5cf0-cef6-5d9633b2f26f',
              status: 'failed',
              error: 'DUPLICATE_TRANSACTION'
            }
          ]
        },
        timestamp: new Date().toISOString()
      };

      expect(() => {
        validateWebSocketEvent(event, 'offline:queue:processed');
      }).not.toThrow();
    });
  });

  describe('group:completed - Group Completion Bonus Broadcast', () => {

    it('should validate group:completed event', () => {
      const event = {
        event: 'group:completed',
        data: {
          teamId: '001',
          group: 'jaw_group',
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

  describe('error - Error Notification', () => {

    it('should validate error event with all error codes', () => {
      const errorCodes = [
        'AUTH_REQUIRED',
        'PERMISSION_DENIED',
        'VALIDATION_ERROR',
        'SESSION_NOT_FOUND',
        'TOKEN_NOT_FOUND',
        'DUPLICATE_TRANSACTION',
        'INVALID_REQUEST',
        'VLC_ERROR',
        'INTERNAL_ERROR'
      ];

      errorCodes.forEach(code => {
        const event = {
          event: 'error',
          data: {
            code: code,
            message: `Test error: ${code}`,
            details: null
          },
          timestamp: new Date().toISOString()
        };

        expect(() => {
          validateWebSocketEvent(event, 'error');
        }).not.toThrow();
      });
    });

    it('should reject invalid error codes', () => {
      const event = {
        event: 'error',
        data: {
          code: 'INVALID_ERROR_CODE',
          message: 'Test',
          details: null
        },
        timestamp: new Date().toISOString()
      };

      expect(() => {
        validateWebSocketEvent(event, 'error');
      }).toThrow();
    });
  });

  describe('Wrapped Envelope Pattern - All Inbound Events', () => {

    it('should validate all server→client events use wrapped envelope', () => {
      const events = [
        {
          name: 'sync:full',
          event: {
            event: 'sync:full',
            data: {
              session: null,
              scores: [],
              recentTransactions: [],
              videoStatus: { status: 'idle', queueLength: 0 },
              devices: [],
              systemStatus: { orchestrator: 'online', vlc: 'connected' }
            },
            timestamp: new Date().toISOString()
          }
        },
        {
          name: 'transaction:result',
          event: {
            event: 'transaction:result',
            data: {
              status: 'accepted',
              transactionId: '7b8b1d85-b234-4be9-bde5-4c8522a1f15e',
              tokenId: 'test',
              teamId: '001',
              points: 1000,
              message: 'OK',
              error: null
            },
            timestamp: new Date().toISOString()
          }
        },
        {
          name: 'score:updated',
          event: {
            event: 'score:updated',
            data: {
              teamId: '001',
              currentScore: 1000,
              baseScore: 1000,
              bonusPoints: 0,
              tokensScanned: 1,
              completedGroups: [],
              adminAdjustments: [],
              lastUpdate: new Date().toISOString()
            },
            timestamp: new Date().toISOString()
          }
        }
      ];

      events.forEach(({ name, event }) => {
        // Verify wrapped structure
        expect(event).toHaveProperty('event');
        expect(event).toHaveProperty('data');
        expect(event).toHaveProperty('timestamp');

        // Validate against contract
        expect(() => {
          validateWebSocketEvent(event, name);
        }).not.toThrow();
      });
    });
  });
});
