/**
 * Winston Logger Setup for ALN Orchestrator
 * Provides structured logging with multiple transports
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');
const config = require('../config');

// Ensure logs directory exists
const logsDir = config.storage.logsDir;
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format that serializes Error instances in metadata to plain objects.
// Without this, winston's JSON transport renders Error objects as {} (empty).
const serializeErrors = winston.format((info) => {
  if (info.metadata && typeof info.metadata === 'object') {
    for (const [key, val] of Object.entries(info.metadata)) {
      if (val instanceof Error) {
        info.metadata[key] = { message: val.message, stack: val.stack, name: val.name, ...val };
      }
      // Also check one level deeper (metadata.metadata from winston's metadata format)
      if (val && typeof val === 'object' && !(val instanceof Error)) {
        for (const [k2, v2] of Object.entries(val)) {
          if (v2 instanceof Error) {
            val[k2] = { message: v2.message, stack: v2.stack, name: v2.name, ...v2 };
          }
        }
      }
    }
  }
  return info;
});

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp', 'label'] }),
  serializeErrors()
);

// Console format with colors
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, metadata }) => {
    let output = `${timestamp} [${level}]: ${message}`;
    if (metadata && Object.keys(metadata).length > 0) {
      output += ` ${JSON.stringify(metadata)}`;
    }
    return output;
  })
);

// JSON format for files
const jsonFormat = winston.format.combine(
  logFormat,
  winston.format.json()
);

// Create logger instance
const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  defaultMeta: { service: 'aln-orchestrator' },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: config.logging.format === 'json' ? jsonFormat : consoleFormat,
    }),
    // File transport for all logs
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      format: jsonFormat,
      maxsize: config.logging.maxSize,
      maxFiles: config.logging.maxFiles,
    }),
    // File transport for errors
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      format: jsonFormat,
      maxsize: config.logging.maxSize,
      maxFiles: config.logging.maxFiles,
    }),
  ],
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log'),
      format: jsonFormat,
    }),
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log'),
      format: jsonFormat,
    }),
  ],
});

// Add request logging helper
logger.logRequest = (req, res, responseTime) => {
  const logData = {
    method: req.method,
    url: req.url,
    status: res.statusCode,
    responseTime: `${responseTime}ms`,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent'),
  };

  if (res.statusCode >= 400) {
    logger.warn('Request failed', logData);
  } else {
    logger.info('Request completed', logData);
  }
};

// Add WebSocket event logging helper
logger.logSocketEvent = (event, socketId, data = {}) => {
  logger.debug('WebSocket event', {
    event,
    socketId,
    ...data,
  });
};

// Add transaction logging helper
logger.logTransaction = (transaction, action) => {
  logger.info(`Transaction ${action}`, {
    transactionId: transaction.id,
    tokenId: transaction.tokenId,
    teamId: transaction.teamId,
    status: transaction.status,
    action,
  });
};

// Add error logging helper with context
logger.logError = (error, context = {}) => {
  logger.error(error.message, {
    stack: error.stack,
    code: error.code,
    ...context,
  });
};

// Handle uncaught exceptions and rejections
// Guard against duplicate handlers in test environment
let handlersRegistered = false;

if (!handlersRegistered && process.env.NODE_ENV !== 'test') {
  handlersRegistered = true;

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
    // Give logger time to write before exiting
    setTimeout(() => process.exit(1), 1000);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection', { reason, promise });
  });
}

// Export logger instance
module.exports = logger;