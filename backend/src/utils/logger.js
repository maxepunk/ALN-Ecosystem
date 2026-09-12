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
// Held by reference: the closed-output-pipe guard below silences THIS
// transport (and listens on it), and the reproduction asserts on it.
const consoleTransport = new winston.transports.Console({
  format: config.logging.format === 'json' ? jsonFormat : consoleFormat,
});

const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  defaultMeta: { service: 'aln-orchestrator' },
  // Never let Winston exit the process. With exceptionHandlers/rejectionHandlers
  // configured, the default (exitOnError: true) makes Winston call process.exit(1)
  // after handling an uncaught exception or unhandled rejection — which would kill
  // the orchestrator mid-game (and Playwright E2E workers) on any stray rejection.
  // We log it and keep running; our own process.on handlers decide on shutdown.
  exitOnError: false,
  transports: [
    // Console transport
    consoleTransport,
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

// ---------------------------------------------------------------------------
// Closed-output-pipe guard (P22)
//
// When whatever owns the other end of stdout/stderr goes away — a Playwright
// worker that died, a PM2 daemon that was killed — every Console write fails.
// Winston registers its OWN uncaughtException handler (unconditionally, because
// `exceptionHandlers` is configured above; exception-handler.js:51) and fans
// each exception back through the same closed Console transport, so the failure
// re-throws and is handled again: an orphaned orchestrator writes ~40 MB/s into
// its own combined.log until the disk is full.
//
// The guard sits at the stream, is attached at module load and lives OUTSIDE
// the NODE_ENV gate below — every harness orchestrator runs with
// NODE_ENV='test', so anything inside that gate is absent exactly where the
// storm happens. On either closed-pipe code it silences the Console transport
// and writes ONE line through the file transports. The process SURVIVES with a
// silent console: under PM2 a daemon's death must never kill a running show.
const CLOSED_PIPE_CODES = new Set(['EPIPE', 'ERR_STREAM_DESTROYED']);

// Write-once per process: stdout and stderr can both fail, and the storm this
// guards against is precisely repetition.
let guardLineWritten = false;

/**
 * Silence the console transport and log the reason once.
 * Shared by the stream listeners, the transport listener and the app's
 * uncaughtException handler — a synchronous write to a destroyed stream throws
 * instead of emitting, so the same two codes arrive by either road.
 * @param {string} code - 'EPIPE' or 'ERR_STREAM_DESTROYED'
 */
function silenceConsoleTransport(code) {
  // Idempotent: setting silent twice is free, and each caller must be able to
  // rely on the console being quiet when it returns.
  consoleTransport.silent = true;

  if (guardLineWritten) {
    return;
  }
  guardLineWritten = true;
  // File transports only — the console is closed by definition.
  logger.warn(`console output closed (${code}); console transport silenced`);
}

/**
 * Stream/transport 'error' listener. Anything that is not a closed pipe is
 * absorbed unchanged (an unhandled 'error' event would otherwise be rethrown).
 * @param {Error} error
 */
function handleOutputError(error) {
  if (error && CLOSED_PIPE_CODES.has(error.code)) {
    silenceConsoleTransport(error.code);
  }
}

for (const stream of [process.stdout, process.stderr]) {
  // Jest gives every test FILE its own module registry while the real streams
  // are shared, so this module can be instantiated many times in one process.
  // Raising the cap alongside each attachment keeps the guard from ever being
  // mistaken for a listener leak, without hiding real ones.
  stream.setMaxListeners(stream.getMaxListeners() + 1);
  stream.on('error', handleOutputError);
}

// Belt and braces: contain an 'error' emitted by the Console transport itself,
// regardless of NODE_ENV. (A throw raised synchronously inside transport.log()
// propagates out of the write call rather than as an event — that road is the
// uncaughtException branch below.)
consoleTransport.on('error', handleOutputError);

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
    // A synchronous write to a destroyed stream THROWS instead of emitting, so
    // the closed-pipe codes reach us here as well. Silence the console and keep
    // running: the orphan survives, it does not exit.
    if (error && CLOSED_PIPE_CODES.has(error.code)) {
      silenceConsoleTransport(error.code);
      return;
    }
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