/**
 * Express Application Setup
 * Main application configuration and middleware setup
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const logger = require('./utils/logger');
const { ValidationError } = require('./utils/validators');

// Import services
const persistenceService = require('./services/persistenceService');
const sessionService = require('./services/sessionService');
const stateService = require('./services/stateService');
const transactionService = require('./services/transactionService');
const videoQueueService = require('./services/videoQueueService');
const vlcService = require('./services/vlcService');
const offlineQueueService = require('./services/offlineQueueService');
const displayControlService = require('./services/displayControlService');
const bluetoothService = require('./services/bluetoothService');
const audioRoutingService = require('./services/audioRoutingService');
const lightingService = require('./services/lightingService');

// Import routes (6 files after health extraction)
const scanRoutes = require('./routes/scanRoutes');
const stateRoutes = require('./routes/stateRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
const adminRoutes = require('./routes/adminRoutes');
const resourceRoutes = require('./routes/resourceRoutes');
const healthRoutes = require('./routes/healthRoutes');

// Create Express app
const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for development
}));

// CORS configuration
app.use(cors({
  origin: (origin, callback) => {
    // Allow no-origin requests (mobile apps, curl, file://)
    if (!origin) return callback(null, true);

    // Check configured origins first
    if (config.server.corsOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Test mode - allow any localhost origin (for dynamic port allocation)
    if (process.env.NODE_ENV === 'test' && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
      return callback(null, true);
    }

    // Allow all local network ranges (RFC1918) and .local mDNS hostnames
    const localNetwork = /^https?:\/\/(localhost|127\.0\.0\.1|[\w-]+\.local|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})(:\d+)?$/;
    if (localNetwork.test(origin)) {
      return callback(null, true);
    }

    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Body parsing middleware
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  
  // Log response after it's sent
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    logger.logRequest(req, res, responseTime);
  });
  
  next();
});

// Rate limiting - Create limiter function to avoid initialization at module load
function createRateLimiter() {
  return rateLimit({
    windowMs: config.security.rateLimitWindow,
    max: config.security.rateLimitMax,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  });
}

// Apply rate limiting to API routes (only create when not in test)
if (process.env.NODE_ENV !== 'test') {
  app.use('/api/', createRateLimiter());
}

// API Routes (8 HTTP endpoints after Phase 1.2 consolidation)
app.use('/api/scan', scanRoutes);           // POST /api/scan, POST /api/scan/batch
app.use('/api/session', sessionRoutes);     // GET /api/session
app.use('/api/state', stateRoutes);         // GET /api/state
app.use('/api/admin', adminRoutes);         // POST /api/admin/auth, GET /api/admin/logs
app.use('/api', resourceRoutes);            // GET /api/tokens
app.use('/', healthRoutes);                 // GET /health (with optional device tracking)
app.use('/', resourceRoutes);               // GET /scoreboard

// Static files (if needed)
app.use(express.static('public'));

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'NOT_FOUND',
    message: 'Endpoint not found',
    path: req.path,
  });
});

// Error handler
app.use((err, _req, res, _next) => {
  logger.error('Unhandled error', err);

  res.status(err.status || 500).json({
    error: 'INTERNAL_ERROR',
    message: err.message || 'Internal server error',
  });
});

// Initialize services
async function initializeServices() {
  try {
    logger.info('Initializing services...');

    // Initialize persistence first
    await persistenceService.init();

    // Load tokens from service (handles submodule paths and fallback)
    const tokenService = require('./services/tokenService');
    const tokens = tokenService.loadTokens();
    await persistenceService.saveTokens(tokens);
    await transactionService.init(tokens);

    // Initialize other services
    await sessionService.init();
    await stateService.init();
    await offlineQueueService.init();

    // Initialize offline status middleware with the service instance
    const offlineStatusMiddleware = require('./middleware/offlineStatus');
    offlineStatusMiddleware.initializeWithService(offlineQueueService);
    
    // Initialize environment control services (Phase 0)
    // Non-blocking: each service logs a warning and continues if unavailable
    await bluetoothService.init();        // Check adapter, warn if unavailable
    await audioRoutingService.init();     // Start sink monitor, load persisted routes
    await lightingService.init();         // Non-blocking HA connection check

    // Initialize VLC service only if video playback is enabled
    if (config.features.videoPlayback) {
      // Add error handler to prevent crashes from VLC connection failures
      vlcService.on('error', (error) => {
        logger.error('VLC service error (non-fatal)', error);
        logger.info('System will continue without video playback functionality');
      });

      // Update state service when VLC connects/disconnects
      vlcService.on('connected', () => {
        stateService.updateSystemStatus({ vlcConnected: true });
      });

      vlcService.on('disconnected', () => {
        stateService.updateSystemStatus({ vlcConnected: false });
      });

      try {
        await vlcService.init();
        // Initialize idle loop after VLC is connected
        await vlcService.initializeIdleLoop();

        // Initialize display control service with VLC and video queue dependencies
        displayControlService.init({ vlcService, videoQueueService });
        logger.info('Display control service initialized');
      } catch (error) {
        logger.warn('VLC service initialization failed - continuing without video playback', error);
        // Don't throw - allow system to run without VLC
      }
    } else {
      logger.info('VLC service disabled - video playback feature is off');
    }
    
    // GameState is now computed - verify it derives correctly
    const currentSession = sessionService.getCurrentSession();
    if (currentSession) {
      const currentState = stateService.getCurrentState();
      logger.info('Session loaded on startup', {
        sessionId: currentSession.id,
        status: currentSession.status,
        hasState: !!currentState
      });

      // Sanity check: state should exist if session exists
      if (!currentState) {
        logger.error('CRITICAL: Session exists but GameState failed to derive', {
          sessionId: currentSession.id
        });
      }
    } else {
      logger.info('No previous session - ready for new game');
    }
    
    logger.info('All services initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize services', error);
    throw error;
  }
}

// Export app and initialization function
module.exports = app;
module.exports.app = app;
module.exports.initializeServices = initializeServices;