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

// Import routes
const scanRoutes = require('./routes/scanRoutes');
const stateRoutes = require('./routes/stateRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const videoRoutes = require('./routes/videoRoutes');
const adminRoutes = require('./routes/adminRoutes');
const adminPanelRoutes = require('./routes/adminPanelRoutes');
const docsRoutes = require('./routes/docsRoutes');
const tokenRoutes = require('./routes/tokenRoutes');

// Create Express app
const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for development
}));

// CORS configuration
app.use(cors({
  origin: (origin, callback) => {
    // In test mode, allow any localhost origin (for dynamic port allocation)
    if (process.env.NODE_ENV === 'test' && (!origin || origin?.includes('localhost') || origin?.includes('127.0.0.1'))) {
      callback(null, true);
    } else if (!origin || config.server.corsOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
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

// Rate limiting
const limiter = rateLimit({
  windowMs: config.security.rateLimitWindow,
  max: config.security.rateLimitMax,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to API routes
app.use('/api/', limiter);

// Health check endpoint
app.get('/health', (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      orchestrator: true,
      vlc: vlcService.isConnected(),
      videoDisplay: stateService.getCurrentState()?.systemStatus?.videoDisplayReady || false,
    },
  };
  
  res.json(health);
});

// API Routes
app.use('/api/scan', scanRoutes);
app.use('/api/session', sessionRoutes);
app.use('/api/state', stateRoutes);
app.use('/api/transaction', transactionRoutes);
app.use('/api/video', videoRoutes);
app.use('/api/admin', adminPanelRoutes);
app.use('/api/admin', adminRoutes);
app.use('/', tokenRoutes); // Token routes have /api/tokens internally

// Documentation routes (no /api prefix)
app.use('/', docsRoutes);

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
app.use((err, req, res, next) => {
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
    
    // Initialize VLC service only if video playback is enabled
    if (config.features.videoPlayback) {
      // Add error handler to prevent crashes from VLC connection failures
      vlcService.on('error', (error) => {
        logger.error('VLC service error (non-fatal)', error);
        logger.info('System will continue without video playback functionality');
      });

      try {
        await vlcService.init();
      } catch (error) {
        logger.warn('VLC service initialization failed - continuing without video playback', error);
        // Don't throw - allow system to run without VLC
      }
    } else {
      logger.info('VLC service disabled - video playback feature is off');
    }
    
    // Sync state if there's an active session
    const currentSession = sessionService.getCurrentSession();
    if (currentSession) {
      await stateService.syncFromSession(currentSession);
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