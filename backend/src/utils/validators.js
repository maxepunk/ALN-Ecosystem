/**
 * Joi Validation Schemas for ALN Orchestrator
 * Defines validation rules for all data entities
 */

const Joi = require('joi');

// Custom validators
const isoDate = Joi.string().isoDate();
const uuid = Joi.string().uuid({ version: 'uuidv4' });
// Team names: any non-empty string. GM types it, we store it.
const teamId = Joi.string().trim();

// Wire-ingress mode check (Phase 3 A3 slice 1): valid `mode` values are
// the ACTIVE pack's declared mode ids (game.json modes[].id), resolved at
// VALIDATION time — the closed two-value enum retired with slice 1 (open
// mode vocabulary; contracts document the runtime rule). Emits the same
// `any.only` error shape the enum produced, so rejections look identical
// on the wire. Lazy requires: keeps utils→services acyclic at load time
// (packService imports no validators) and picks up post-boot activation.
const packDeclaredMode = Joi.string().custom((value, helpers) => {
  const { wireModeIds } = require('../gameRules/modeSemantics');
  const packService = require('../services/packService');
  const valids = wireModeIds(packService.getGameConfig());
  if (!valids.includes(value)) {
    return helpers.error('any.only', { valids });
  }
  return value;
}, 'pack-declared mode id');

// Token validation schema
const tokenSchema = Joi.object({
  id: Joi.string().required().min(1).max(100),  // Database lookup validates token existence
  name: Joi.string().required().min(1).max(200),
  value: Joi.number().integer().min(0).required(),
  memoryType: Joi.string().required(),
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
    rating: Joi.number().integer().min(1).max(5).optional().allow(null),
    owner: Joi.string().optional().allow(null),
  }).required(),
});

// Transaction validation schema
const transactionSchema = Joi.object({
  id: uuid.required(),
  tokenId: Joi.string().required().min(1).max(100),
  teamId: teamId.required(),
  deviceId: Joi.string().required().min(1).max(100),
  deviceType: Joi.string().valid('gm', 'player', 'esp32').required(),  // P0.1 Correction: Required for duplicate detection logic
  // PERSISTED-HISTORY schema: mode is any string — history is data, not a
  // command; a session restored under a different pack must never fail
  // hydration on its recorded mode ids (restore already loud-warns on pack
  // mismatch). Strict pack-derived enforcement lives at the wire ingress
  // (gmTransactionSchema). The 'blackmarket' default is the STABLE
  // legacy-history reading for pre-mode records, not a wire default.
  mode: Joi.string().optional().default('blackmarket'),
  summary: Joi.string().max(350).optional().allow(null, ''),  // OPTIONAL - custom summary for evidence-surface modes (per AsyncAPI contract)
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
  status: Joi.string().valid('setup', 'active', 'paused', 'ended').required(),  // Per OpenAPI/AsyncAPI contract
  transactions: Joi.array().items(transactionSchema).default([]),
  connectedDevices: Joi.array().items(Joi.object()).default([]),
  videoQueue: Joi.array().items(Joi.object()).default([]),
  scores: Joi.array().items(Joi.object()).default([]),
  metadata: Joi.object({
    gmStations: Joi.number().integer().min(0).required(),
    playerDevices: Joi.number().integer().min(0).required(),
    totalScans: Joi.number().integer().min(0).required(),
    uniqueTokensScanned: Joi.array().items(Joi.string()).required(),
    // A2: the pack this session was created under ("rules frozen at
    // start"); null for legacy sessions and pre-pack checkouts.
    pack: Joi.object({
      packId: Joi.string().required(),
      version: Joi.string().required(),
      contentHash: Joi.string().required(),
    }).allow(null).optional(),
  }).required(),
});

// VideoQueueItem validation schema
const videoQueueItemSchema = Joi.object({
  id: uuid.required(),
  tokenId: Joi.string().required().min(1).max(100),
  requestedBy: Joi.string().required().min(1).max(100),
  requestTime: isoDate.required(),
  status: Joi.string().valid('pending', 'playing', 'paused', 'completed', 'failed').required(),
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

// API Request validation schemas

// Player Scanner HTTP scan (POST /api/scan) - OpenAPI contract
// NO mode field - Player Scanner doesn't do game transactions
const playerScanRequestSchema = Joi.object({
  tokenId: Joi.string().required().min(1).max(100),  // Database lookup validates token existence
  teamId: teamId.optional(),  // OPTIONAL - players haven't committed to teams yet
  deviceId: Joi.string().required().min(1).max(100),
  deviceType: Joi.string().valid('player', 'esp32').required(),  // P0.1 Correction: Required for duplicate detection logic
  timestamp: isoDate.optional(),
});

// GM Scanner WebSocket transaction (transaction:submit) - AsyncAPI contract
// REQUIRES mode field - GM Scanner does game transactions
const gmTransactionSchema = Joi.object({
  tokenId: Joi.string().required().min(1).max(100),  // Database lookup validates token existence
  teamId: teamId.required(),  // REQUIRED for GM transactions
  deviceId: Joi.string().required().min(1).max(100),
  deviceType: Joi.string().valid('gm').required(),  // P0.1 Correction: Required, must be 'gm'
  mode: packDeclaredMode.required(),  // REQUIRED, validated against the active pack's declared modes - no default
  summary: Joi.string().max(350).optional().allow(null, ''),  // OPTIONAL - custom summary for evidence-surface modes (per AsyncAPI contract)
  clientTxId: Joi.string().max(100).optional(),  // OPTIONAL - client correlation id echoed on transaction:result (TQ-3); MUST be declared or validate()'s stripUnknown:true drops it
  timestamp: isoDate.optional(),
});

const sessionCreateSchema = Joi.object({
  name: Joi.string().required().min(1).max(100),
  teams: Joi.array().items(teamId).min(0).max(10).optional(),  // Allow empty array
});

const sessionUpdateSchema = Joi.object({
  status: Joi.string().valid('setup', 'active', 'paused', 'ended').optional(),
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
  videoQueueItemSchema,
  deviceConnectionSchema,
  teamScoreSchema,

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