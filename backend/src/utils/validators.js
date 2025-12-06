/**
 * Joi Validation Schemas for ALN Orchestrator
 * Defines validation rules for all data entities
 */

const Joi = require('joi');

// Custom validators
const isoDate = Joi.string().isoDate();
const uuid = Joi.string().uuid({ version: 'uuidv4' });
const teamId = Joi.string()
  .pattern(/^[A-Za-z0-9 _-]{1,30}$/)
  .min(1)
  .max(30)
  .trim();  // Team names: alphanumeric, spaces, underscores, hyphens (1-30 chars)

// Token validation schema
const tokenSchema = Joi.object({
  id: Joi.string().required().min(1).max(100)
    .pattern(/^[A-Za-z_0-9]+$/),  // Allow alphanumeric token IDs
  name: Joi.string().required().min(1).max(200),
  value: Joi.number().integer().min(0).required(),
  memoryType: Joi.string().valid('Technical', 'Business', 'Personal').required(),  // AsyncAPI contract values (Decision #4)
  groupId: Joi.string().optional().allow(null),
  mediaAssets: Joi.object({
    image: Joi.string().optional().allow(null),
    audio: Joi.string().optional().allow(null),
    video: Joi.string().optional().allow(null),
    processingImage: Joi.string().optional().allow(null),
  }).required(),
  metadata: Joi.object({
    duration: Joi.number().positive().optional(),
    priority: Joi.number().integer().min(0).max(10).optional(),
    rfid: Joi.string().optional().allow(null),
    group: Joi.string().optional().allow(null, ''),  // Allow empty string for tokens without groups
    originalType: Joi.string().optional().allow(null),
    rating: Joi.number().integer().min(1).max(5).optional(),
  }).required(),
});

// Transaction validation schema
const transactionSchema = Joi.object({
  id: uuid.required(),
  tokenId: Joi.string().required().min(1).max(100),
  teamId: teamId.required(),
  deviceId: Joi.string().required().min(1).max(100),
  deviceType: Joi.string().valid('gm', 'player', 'esp32').required(),  // P0.1 Correction: Required for duplicate detection logic
  mode: Joi.string().valid('detective', 'blackmarket').optional().default('blackmarket'),
  summary: Joi.string().max(350).optional().allow(null, ''),  // OPTIONAL - custom summary for detective mode (per AsyncAPI contract)
  timestamp: isoDate.required(),
  sessionId: uuid.required(),
  status: Joi.string().valid('accepted', 'error', 'duplicate').required(),  // AsyncAPI contract values (Decision #4)
  rejectionReason: Joi.string().optional().allow(null),
  points: Joi.number().integer().min(0).required(),
});

// Session validation schema
const sessionSchema = Joi.object({
  id: uuid.required(),
  name: Joi.string().required().min(1).max(100),
  startTime: isoDate.required(),
  endTime: isoDate.optional().allow(null),
  status: Joi.string().valid('active', 'paused', 'ended').required(),  // Per OpenAPI/AsyncAPI contract
  transactions: Joi.array().items(transactionSchema).default([]),
  connectedDevices: Joi.array().items(Joi.object()).default([]),
  videoQueue: Joi.array().items(Joi.object()).default([]),
  scores: Joi.array().items(Joi.object()).default([]),
  metadata: Joi.object({
    gmStations: Joi.number().integer().min(0).required(),
    playerDevices: Joi.number().integer().min(0).required(),
    totalScans: Joi.number().integer().min(0).required(),
    uniqueTokensScanned: Joi.array().items(Joi.string()).required(),
  }).required(),
});

// GameState validation schema
const gameStateSchema = Joi.object({
  sessionId: uuid.required(),
  lastUpdate: isoDate.required(),
  currentVideo: Joi.object({
    tokenId: Joi.string().required(),
    startTime: isoDate.required(),
    expectedEndTime: isoDate.required(),
    requestedBy: Joi.string().required(),
  }).optional().allow(null),
  scores: Joi.array().items(Joi.object()).required(),
  recentTransactions: Joi.array().items(transactionSchema).required(),
  systemStatus: Joi.object({
    orchestratorOnline: Joi.boolean().required(),
    vlcConnected: Joi.boolean().required(),
    videoDisplayReady: Joi.boolean().required(),
  }).required(),
});

// VideoQueueItem validation schema
const videoQueueItemSchema = Joi.object({
  id: uuid.required(),
  tokenId: Joi.string().required().min(1).max(100),
  requestedBy: Joi.string().required().min(1).max(100),
  requestTime: isoDate.required(),
  status: Joi.string().valid('pending', 'playing', 'completed', 'failed').required(),
  videoPath: Joi.string().required(),
  playbackStart: isoDate.optional().allow(null),
  playbackEnd: isoDate.optional().allow(null),
  error: Joi.string().optional().allow(null),
});

// DeviceConnection validation schema
const deviceConnectionSchema = Joi.object({
  id: Joi.string().required().min(1).max(100),
  type: Joi.string().valid('player', 'gm').required(),
  name: Joi.string().optional().allow(null),
  connectionTime: isoDate.required(),
  lastHeartbeat: isoDate.required(),
  connectionStatus: Joi.string().valid('connected', 'disconnected', 'reconnecting').required(),
  ipAddress: Joi.string().ip().optional().allow(null),
  syncState: Joi.object({
    lastSyncTime: isoDate.required(),
    pendingUpdates: Joi.number().integer().min(0).required(),
    syncErrors: Joi.number().integer().min(0).required(),
  }).required(),
});

// TeamScore validation schema
const teamScoreSchema = Joi.object({
  teamId: teamId.required(),
  currentScore: Joi.number().integer().min(0).required(),
  tokensScanned: Joi.number().integer().min(0).required(),
  bonusPoints: Joi.number().integer().min(0).required(),
  completedGroups: Joi.array().items(Joi.string()).required(),
  adminAdjustments: Joi.array().items(Joi.object({
    delta: Joi.number().integer().required(),
    gmStation: Joi.string().required(),
    reason: Joi.string().allow('').required(),
    timestamp: isoDate.required()
  })).default([]),  // Optional with default empty array for backward compatibility
  lastUpdate: isoDate.required(),
});

// AdminConfig validation schema
const adminConfigSchema = Joi.object({
  vlcConfig: Joi.object({
    host: Joi.string().hostname().required(),
    port: Joi.number().port().required(),
    password: Joi.string().required(),
  }).required(),
  sessionConfig: Joi.object({
    maxPlayers: Joi.number().integer().min(1).max(50).required(),
    maxGmStations: Joi.number().integer().min(1).max(10).required(),
    duplicateWindow: Joi.number().integer().min(1).max(60).required(),
    sessionTimeout: Joi.number().integer().min(1).max(1440).required(),
  }).required(),
  networkConfig: Joi.object({
    orchestratorPort: Joi.number().port().required(),
    corsOrigins: Joi.array().items(Joi.string().uri()).required(),
    staticIps: Joi.object().pattern(Joi.string(), Joi.string().ip()).optional(),
  }).required(),
});

// API Request validation schemas

// Player Scanner HTTP scan (POST /api/scan) - OpenAPI contract
// NO mode field - Player Scanner doesn't do game transactions
const playerScanRequestSchema = Joi.object({
  tokenId: Joi.string().required().min(1).max(100)
    .pattern(/^[A-Za-z_0-9]+$/),
  teamId: teamId.optional(),  // OPTIONAL - players haven't committed to teams yet
  deviceId: Joi.string().required().min(1).max(100),
  deviceType: Joi.string().valid('player', 'esp32').required(),  // P0.1 Correction: Required for duplicate detection logic
  timestamp: isoDate.optional(),
});

// GM Scanner WebSocket transaction (transaction:submit) - AsyncAPI contract
// REQUIRES mode field - GM Scanner does game transactions
const gmTransactionSchema = Joi.object({
  tokenId: Joi.string().required().min(1).max(100)
    .pattern(/^[A-Za-z_0-9]+$/),
  teamId: teamId.required(),  // REQUIRED for GM transactions
  deviceId: Joi.string().required().min(1).max(100),
  deviceType: Joi.string().valid('gm').required(),  // P0.1 Correction: Required, must be 'gm'
  mode: Joi.string().valid('detective', 'blackmarket').required(),  // REQUIRED - no default
  summary: Joi.string().max(350).optional().allow(null, ''),  // OPTIONAL - custom summary for detective mode (per AsyncAPI contract)
  timestamp: isoDate.optional(),
});

const sessionCreateSchema = Joi.object({
  name: Joi.string().required().min(1).max(100),
  teams: Joi.array().items(teamId).min(0).max(10).optional(),  // Allow empty array
});

const sessionUpdateSchema = Joi.object({
  status: Joi.string().valid('active', 'paused', 'completed', 'archived').optional(),
  name: Joi.string().min(1).max(100).optional(),
}).min(1).unknown(false); // At least one field required, reject unknown fields

const videoControlSchema = Joi.object({
  action: Joi.string().valid('play', 'pause', 'stop', 'skip').required(),
  videoId: uuid.optional(),
  tokenId: Joi.string().min(1).max(100).optional(), // Support both videoId and tokenId for compatibility
});

// WebSocket message validation schemas

// GM identify schema per WebSocket contract (websocket-events.md)
const gmIdentifySchema = Joi.object({
  stationId: Joi.string().required().min(1).max(100),
  version: Joi.string().required().pattern(/^\d+\.\d+\.\d+$/),
});

// Heartbeat schema per WebSocket contract
const wsHeartbeatSchema = Joi.object({
  stationId: Joi.string().required(),
});

const wsSyncRequestSchema = Joi.object({
  type: Joi.string().valid('sync_request').required(),
  lastSync: isoDate.optional(),
});

// Validation helper functions
const validate = (data, schema) => {
  const { error, value } = schema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
    errors: {
      wrap: {
        label: false  // Prevent template formatting issues
      }
    }
  });

  if (error) {
    const details = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: String(detail.message),  // Explicitly convert to string
    }));
    
    // Create a message that includes field names or the error details
    const fieldNames = details.map(d => d.field).filter(f => f);
    let message;
    if (fieldNames.length > 0) {
      message = `Validation failed: ${fieldNames.join(', ')}`;
    } else if (details.length > 0) {
      // If no field names (e.g., top-level type error), use the error message
      message = details[0].message;
    } else {
      message = 'Validation failed';
    }
    
    throw new ValidationError(message, details);
  }

  return value;
};

// Custom validation error class
class ValidationError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }
}

// Export schemas and validation functions
module.exports = {
  // Entity schemas
  tokenSchema,
  transactionSchema,
  sessionSchema,
  gameStateSchema,
  videoQueueItemSchema,
  deviceConnectionSchema,
  teamScoreSchema,
  adminConfigSchema,

  // API request schemas
  playerScanRequestSchema,
  gmTransactionSchema,
  sessionCreateSchema,
  sessionUpdateSchema,
  videoControlSchema,

  // WebSocket message schemas
  gmIdentifySchema,
  wsHeartbeatSchema,
  wsSyncRequestSchema,

  // Validation functions
  validate,
  ValidationError,

  // Custom validators for reuse
  validators: {
    isoDate,
    uuid,
    teamId,
  },
};