/**
 * OpenAPI Specification for ALN Orchestrator API
 */

const openApiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'ALN Orchestrator API',
    version: '1.0.0',
    description: 'API for managing About Last Night game sessions, video playback, and scoring',
    contact: {
      name: 'ALN Development Team'
    }
  },
  servers: [
    {
      url: 'https://localhost:3000',
      description: 'Development server (HTTPS for NFC support)'
    },
    {
      url: 'https://aln-orchestrator.local:3000',
      description: 'Production server (Raspberry Pi)'
    },
    {
      url: 'http://localhost:8000',
      description: 'HTTP redirect server (redirects to HTTPS)'
    }
  ],
  tags: [
    { name: 'Session', description: 'Session management operations' },
    { name: 'State', description: 'Game state operations' },
    { name: 'Transaction', description: 'Scoring transactions' },
    { name: 'Video', description: 'Video playback control' },
    { name: 'Admin', description: 'Administrative operations' },
    { name: 'Health', description: 'System health monitoring' }
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Check system health',
        operationId: 'getHealth',
        responses: {
          '200': {
            description: 'System is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'healthy' },
                    uptime: { type: 'number' },
                    memory: { type: 'object' },
                    services: { type: 'object' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/session/start': {
      post: {
        tags: ['Session'],
        summary: 'Start a new game session',
        operationId: 'startSession',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string', description: 'Session name' },
                  maxPlayers: { type: 'integer', default: 15 },
                  maxGmStations: { type: 'integer', default: 3 }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Session started successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    data: {
                      type: 'object',
                      properties: {
                        sessionId: { type: 'string' },
                        name: { type: 'string' },
                        startTime: { type: 'string', format: 'date-time' }
                      }
                    }
                  }
                }
              }
            }
          },
          '409': {
            description: 'Session already active'
          }
        }
      }
    },
    '/api/session/end': {
      post: {
        tags: ['Session'],
        summary: 'End the current session',
        operationId: 'endSession',
        responses: {
          '200': {
            description: 'Session ended successfully'
          },
          '400': {
            description: 'No active session'
          }
        }
      }
    },
    '/api/session/status': {
      get: {
        tags: ['Session'],
        summary: 'Get current session status',
        operationId: 'getSessionStatus',
        responses: {
          '200': {
            description: 'Session status retrieved'
          }
        }
      }
    },
    '/api/state/sync': {
      get: {
        tags: ['State'],
        summary: 'Get full game state',
        operationId: 'getFullState',
        responses: {
          '200': {
            description: 'Full state retrieved',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string' },
                    data: {
                      type: 'object',
                      properties: {
                        teams: { type: 'array' },
                        currentRound: { type: 'integer' },
                        timestamp: { type: 'string', format: 'date-time' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/state/update': {
      post: {
        tags: ['State'],
        summary: 'Update game state',
        operationId: 'updateState',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  delta: { type: 'object' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'State updated successfully'
          }
        }
      }
    },
    '/api/transaction/submit': {
      post: {
        tags: ['Transaction'],
        summary: 'Submit a scoring transaction',
        operationId: 'submitTransaction',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['tokenId', 'teamId', 'points'],
                properties: {
                  tokenId: { type: 'string' },
                  teamId: { type: 'string' },
                  points: { type: 'integer' },
                  gmStation: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '202': {
            description: 'Transaction accepted'
          },
          '400': {
            description: 'Invalid transaction'
          },
          '409': {
            description: 'Duplicate transaction'
          }
        }
      }
    },
    '/api/transaction/history': {
      get: {
        tags: ['Transaction'],
        summary: 'Get transaction history',
        operationId: 'getTransactionHistory',
        parameters: [
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 100 }
          },
          {
            name: 'offset',
            in: 'query',
            schema: { type: 'integer', default: 0 }
          }
        ],
        responses: {
          '200': {
            description: 'Transaction history retrieved'
          }
        }
      }
    },
    '/api/video/play': {
      post: {
        tags: ['Video'],
        summary: 'Play a video',
        operationId: 'playVideo',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['tokenId'],
                properties: {
                  tokenId: { type: 'string' },
                  gmStation: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Video playback started'
          }
        }
      }
    },
    '/api/video/queue': {
      get: {
        tags: ['Video'],
        summary: 'Get video queue',
        operationId: 'getVideoQueue',
        responses: {
          '200': {
            description: 'Video queue retrieved'
          }
        }
      }
    },
    '/api/video/status': {
      get: {
        tags: ['Video'],
        summary: 'Get video playback status',
        operationId: 'getVideoStatus',
        responses: {
          '200': {
            description: 'Video status retrieved'
          }
        }
      }
    },
    '/api/video/skip': {
      post: {
        tags: ['Video'],
        summary: 'Skip current video',
        operationId: 'skipVideo',
        responses: {
          '200': {
            description: 'Video skipped'
          }
        }
      }
    },
    '/api/admin/sessions': {
      get: {
        tags: ['Admin'],
        summary: 'List all sessions',
        operationId: 'listSessions',
        security: [{ AdminAuth: [] }],
        responses: {
          '200': {
            description: 'Sessions retrieved'
          },
          '401': {
            description: 'Unauthorized'
          }
        }
      }
    },
    '/api/admin/session/{id}': {
      delete: {
        tags: ['Admin'],
        summary: 'Delete a session',
        operationId: 'deleteSession',
        security: [{ AdminAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        responses: {
          '200': {
            description: 'Session deleted'
          },
          '404': {
            description: 'Session not found'
          }
        }
      }
    },
    '/api/admin/reset': {
      post: {
        tags: ['Admin'],
        summary: 'Reset the system',
        operationId: 'resetSystem',
        security: [{ AdminAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  clearLogs: { type: 'boolean', default: false }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'System reset complete'
          }
        }
      }
    }
  },
  components: {
    securitySchemes: {
      AdminAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-Admin-Token',
        description: 'Admin authentication token'
      }
    },
    schemas: {
      Session: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          active: { type: 'boolean' },
          startTime: { type: 'string', format: 'date-time' },
          endTime: { type: 'string', format: 'date-time', nullable: true },
          connectedDevices: { type: 'array' },
          transactions: { type: 'array' },
          statistics: { type: 'object' }
        }
      },
      Transaction: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          tokenId: { type: 'string' },
          teamId: { type: 'string' },
          points: { type: 'integer' },
          gmStation: { type: 'string' },
          timestamp: { type: 'string', format: 'date-time' },
          status: { type: 'string', enum: ['pending', 'processed', 'rejected'] }
        }
      },
      VideoQueueItem: {
        type: 'object',
        properties: {
          tokenId: { type: 'string' },
          requestedBy: { type: 'string' },
          priority: { type: 'integer' },
          status: { type: 'string', enum: ['pending', 'playing', 'completed', 'failed'] },
          addedAt: { type: 'string', format: 'date-time' }
        }
      },
      Device: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          type: { type: 'string', enum: ['gm', 'player', 'display'] },
          name: { type: 'string' },
          connectionStatus: { type: 'string', enum: ['connected', 'disconnected'] },
          lastHeartbeat: { type: 'string', format: 'date-time' }
        }
      },
      Error: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'error' },
          error: { type: 'string' },
          code: { type: 'string' },
          details: { type: 'object' }
        }
      }
    }
  },
  'x-websocket-events': {
    client: {
      'gm:identify': 'Identify as GM station',
      'heartbeat': 'Send heartbeat',
      'sync:request': 'Request full state sync',
      'state:request': 'Request current state',
      'gm:command': 'Send GM command',
      'transaction:submit': 'Submit transaction via WebSocket',
      'video:play': 'Play video',
      'video:pause': 'Pause video',
      'video:resume': 'Resume video',
      'video:skip': 'Skip video',
      'video:stop': 'Stop video'
    },
    server: {
      'session:new': 'New session created',
      'session:update': 'Session updated',
      'transaction:new': 'New transaction added',
      'state:update': 'State update (delta)',
      'state:sync': 'Full state sync',
      'sync:full': 'Complete sync with all data',
      'video:status': 'Video playback status',
      'video:queued': 'Video added to queue',
      'device:connected': 'Device connected',
      'device:disconnected': 'Device disconnected',
      'error': 'Error notification'
    }
  }
};

module.exports = { openApiSpec };
