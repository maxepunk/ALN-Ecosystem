/**
 * Configuration Management for ALN Orchestrator
 * Centralizes all configuration with environment variable support
 */

const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const config = {
  // Server Configuration
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0',
    env: process.env.NODE_ENV || 'development',
    corsOrigins: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',')
      : ['http://localhost:3000', 'http://localhost:8000', 'http://localhost:8001', 'http://localhost:8080'],
  },

  // SSL/HTTPS Configuration (required for Web NFC API)
  ssl: {
    enabled: process.env.ENABLE_HTTPS === 'true',
    keyPath: process.env.SSL_KEY_PATH || './ssl/key.pem',
    certPath: process.env.SSL_CERT_PATH || './ssl/cert.pem',
    httpRedirectPort: parseInt(process.env.HTTP_REDIRECT_PORT || '8000', 10),
  },

  // VLC Configuration
  vlc: {
    host: process.env.VLC_HOST || 'localhost',
    port: parseInt(process.env.VLC_PORT || '8080', 10),
    password: process.env.VLC_PASSWORD || 'vlc',
    reconnectInterval: parseInt(process.env.VLC_RECONNECT_INTERVAL || '5000', 10),
    maxRetries: parseInt(process.env.VLC_MAX_RETRIES || '3', 10),
  },

  // Session Configuration
  session: {
    maxPlayers: parseInt(process.env.MAX_PLAYERS || '10', 10),
    maxGmStations: parseInt(process.env.MAX_GM_STATIONS || '5', 10),
    duplicateWindow: parseInt(process.env.DUPLICATE_WINDOW || '5', 10), // seconds
    sessionTimeout: parseInt(process.env.SESSION_TIMEOUT || '120', 10), // minutes
    heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL || '30000', 10), // ms
  },

  // Video Configuration
  video: {
    directory: process.env.VIDEO_DIR || './public/videos',
  },

  // Storage Configuration
  storage: {
    dataDir: process.env.DATA_DIR || path.join(process.cwd(), 'data'),
    logsDir: process.env.LOGS_DIR || path.join(process.cwd(), 'logs'),
    backupInterval: parseInt(process.env.BACKUP_INTERVAL || '100', 10), // transactions
    archiveAfter: parseInt(process.env.ARCHIVE_AFTER || '24', 10), // hours
  },

  // Game Configuration
  game: {
    transactionHistoryLimit: parseInt(process.env.TRANSACTION_HISTORY_LIMIT || '1000', 10),
    recentTransactionsCount: parseInt(process.env.RECENT_TRANSACTIONS_COUNT || '10', 10),
    bonusThreshold: parseInt(process.env.BONUS_THRESHOLD || '5', 10),
    bonusMultiplier: parseFloat(process.env.BONUS_MULTIPLIER || '1.5'),

    // Value rating to points mapping
    valueRatingMap: {
      1: parseInt(process.env.VALUE_RATING_1 || '100', 10),
      2: parseInt(process.env.VALUE_RATING_2 || '500', 10),
      3: parseInt(process.env.VALUE_RATING_3 || '1000', 10),
      4: parseInt(process.env.VALUE_RATING_4 || '5000', 10),
      5: parseInt(process.env.VALUE_RATING_5 || '10000', 10),
    },

    // Type multipliers (Personal 1x, Business 3x, Technical 5x)
    typeMultipliers: {
      personal: parseFloat(process.env.TYPE_MULT_PERSONAL || '1.0'),
      business: parseFloat(process.env.TYPE_MULT_BUSINESS || '3.0'),
      technical: parseFloat(process.env.TYPE_MULT_TECHNICAL || '5.0'),
    },
  },

  // Security Configuration
  security: {
    adminPassword: process.env.ADMIN_PASSWORD || 'admin',
    jwtSecret: process.env.JWT_SECRET || 'change-this-secret-in-production',
    jwtExpiry: process.env.JWT_EXPIRY || '24h',
    rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '60000', 10), // ms
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  },

  // WebSocket Configuration
  websocket: {
    pingTimeout: parseInt(process.env.WS_PING_TIMEOUT || '60000', 10),
    pingInterval: parseInt(process.env.WS_PING_INTERVAL || '25000', 10),
    maxPayloadSize: parseInt(process.env.WS_MAX_PAYLOAD || '1000000', 10), // 1MB
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
    maxFiles: parseInt(process.env.LOG_MAX_FILES || '5', 10),
    maxSize: process.env.LOG_MAX_SIZE || '10m',
  },

  // Feature Flags
  features: {
    offlineMode: process.env.ENABLE_OFFLINE_MODE === 'true',
    videoPlayback: process.env.ENABLE_VIDEO_PLAYBACK !== 'false', // default true
    adminPanel: process.env.ENABLE_ADMIN_PANEL !== 'false', // default true
    debugging: process.env.ENABLE_DEBUGGING === 'true',
  },
};

// Backward compatibility aliases
config.jwt = {
  secret: config.security.jwtSecret,
  expiry: config.security.jwtExpiry,
};

config.admin = {
  password: config.security.adminPassword,
};

config.rateLimit = {
  windowMs: config.security.rateLimitWindow,
  max: config.security.rateLimitMax,
};

// Validate critical configuration
function validateConfig() {
  const errors = [];

  if (config.server.port < 1 || config.server.port > 65535) {
    errors.push('Invalid server port');
  }

  if (config.session.maxPlayers < 1) {
    errors.push('maxPlayers must be at least 1');
  }

  if (config.session.maxGmStations < 1) {
    errors.push('maxGmStations must be at least 1');
  }

  if (config.session.duplicateWindow < 1) {
    errors.push('duplicateWindow must be at least 1 second');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration errors: ${errors.join(', ')}`);
  }
}

// Validate on load
validateConfig();

module.exports = config;