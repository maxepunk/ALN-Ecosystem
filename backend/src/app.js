/**
 * Express Application Setup
 * Main application configuration and middleware setup
 */

const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const logger = require('./utils/logger');

// Import services
const persistenceService = require('./services/persistenceService');
const sessionService = require('./services/sessionService');
const transactionService = require('./services/transactionService');
const videoQueueService = require('./services/videoQueueService');
const vlcService = require('./services/vlcMprisService');
const offlineQueueService = require('./services/offlineQueueService');
const displayControlService = require('./services/displayControlService');
const bluetoothService = require('./services/bluetoothService');
const audioRoutingService = require('./services/audioRoutingService');
const lightingService = require('./services/lightingService');
const gameClockService = require('./services/gameClockService');
const cueEngineService = require('./services/cueEngineService');
const soundService = require('./services/soundService');
const musicService = require('./services/musicService');
const serviceHealthRegistry = require('./services/serviceHealthRegistry');

// Import routes (6 files after health extraction)
const scanRoutes = require('./routes/scanRoutes');
const stateRoutes = require('./routes/stateRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
const adminRoutes = require('./routes/adminRoutes');
const resourceRoutes = require('./routes/resourceRoutes');
const packRoutes = require('./routes/packRoutes');
const healthRoutes = require('./routes/healthRoutes');
const createMusicRouter = require('./routes/musicRoutes');

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
app.use('/api/music', createMusicRouter({ musicService })); // GET /api/music/{tracks,playlists}, PUT /api/music/playlists
app.use('/api', resourceRoutes);            // GET /api/tokens
app.use('/api', packRoutes);                // GET /api/pack/manifest, /api/pack/files/<path> (A2)
app.use('/', healthRoutes);                 // GET /health (with optional device tracking)
app.use('/', resourceRoutes);               // GET /scoreboard

// Static files (if needed)
// Injection seam (2.x.4, generalized to a pack DIRECTORY in Phase 3 A2):
// when PACK_PATH is set, the scanners' relative token fetches (gm-scanner
// standalone: 'data/tokens.json'; player-scanner) must resolve to the SAME
// injected pack the backend loaded — otherwise the system would run
// split-brained on two packs. Registered before static so it shadows the
// bundled dist copies. Not registered at all in production.
if (process.env.PACK_PATH) {
  const injectedTokenPaths = [
    '/gm-scanner/tokens.json',
    '/gm-scanner/data/tokens.json',
    '/player-scanner/tokens.json',
    '/player-scanner/data/tokens.json',
  ];
  app.get(injectedTokenPaths, (req, res) => {
    res.sendFile(path.join(path.resolve(process.env.PACK_PATH), 'tokens.json'));
  });
}

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

  // Return 200 for unparseable JSON bodies so ESP32 scanners clear their queue
  // (ESP32 uploadQueueBatch only calls removeUploadedEntries on HTTP 200)
  if (err.type === 'entity.parse.failed') {
    logger.warn('Returning 200 for unparseable body to clear ESP32 queue', {
      url: _req.url,
      ip: _req.ip,
    });
    return res.status(200).json({
      error: 'PARSE_FAILED',
      message: 'Request body permanently unparseable — discarded',
    });
  }

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

    // A2/A3: freeze the pack identity + serving whitelist BEFORE loading
    // token data, so token values bake from the SAME frozen snapshot the
    // process advertises (/health contentHash). Ordering matters (review
    // finding): activating after loadTokens left a window where a pack
    // edit landed between the two — token values from one game.json,
    // identity from another — and made every per-token getScoringRules()
    // call take the uncached live-disk path.
    require('./services/packService').activatePack();

    // Load tokens from service (handles submodule paths and fallback)
    const tokenService = require('./services/tokenService');
    const tokens = tokenService.loadTokens();
    await persistenceService.saveTokens(tokens);
    await transactionService.init(tokens);

    // Initialize other services
    await sessionService.init();
    await offlineQueueService.init();

    // Initialize environment control services (Phase 0)
    // Non-blocking: each service logs a warning and continues if unavailable
    await bluetoothService.init();        // Check adapter, warn if unavailable
    await audioRoutingService.init();     // Start sink monitor, load persisted routes
    await lightingService.init();         // Non-blocking HA connection check
    await soundService.init();            // Check pw-play availability

    // Initialize Music service (MPD)
    // Set service paths so spawnMpd and playlist watcher work
    const pathMod = require('path');
    musicService._musicDir = pathMod.resolve(__dirname, '../public/music');
    // _mpdRuntimeDir intentionally not overridden — the constructor default
    // '/tmp' is correct. MPD's working files (db/log/state/pid/m3u) must NOT
    // share a directory with persistenceService's node-persist storage; the
    // guard in musicService.spawnMpd() enforces this invariant.
    musicService._playlistFile = pathMod.resolve(__dirname, '../config/music-playlists.json');
    musicService._configFile = '/tmp/aln-mpd.conf';
    if (process.env.ENABLE_MUSIC_PLAYBACK !== 'false') {
      try {
        await musicService.spawnMpd();
        // Allow MPD a moment to bind its Unix socket before connecting
        await new Promise(resolve => setTimeout(resolve, 1000));
        await musicService.init();
      } catch (err) {
        logger.warn('Music service init failed (non-blocking)', { error: err.message });
      }
    } else {
      // Tests/CI: skip MPD spawn but still load playlists from disk
      musicService._loadPlaylistsFromDisk();
    }

    // Initialize Phase 1 services (game clock, cue engine, sound)
    // Load cue definitions from config
    const fs = require('fs').promises;
    const path = require('path');
    const cuesPath = path.join(__dirname, '../config/environment/cues.json');
    try {
      const cuesData = await fs.readFile(cuesPath, 'utf8');
      const cuesConfig = JSON.parse(cuesData);
      // Support both plain array and wrapped {cues: [...]} formats
      const cuesArray = Array.isArray(cuesConfig) ? cuesConfig : (cuesConfig.cues || []);
      cueEngineService.loadCues(cuesArray);
      logger.info('Cue engine loaded cue definitions', { count: cuesArray.length });
    } catch (err) {
      logger.warn('Failed to load cue definitions - cue engine will be empty', { error: err.message });
    }

    // Wire game events to cue engine (shared with systemReset re-initialization)
    const listenerRegistry = require('./websocket/listenerRegistry');
    const { setupCueEngineForwarding } = require('./services/cueEngineWiring');
    setupCueEngineForwarding({
      listenerRegistry,
      transactionService,
      sessionService,
      videoQueueService,
      gameClockService,
      cueEngineService,
      soundService,
      musicService
    });

    // Load ducking rules from routing config
    const routingPath = path.join(__dirname, '../config/environment/routing.json');
    try {
      const routingData = await fs.readFile(routingPath, 'utf8');
      const routingConfig = JSON.parse(routingData);
      if (routingConfig.ducking && Array.isArray(routingConfig.ducking)) {
        audioRoutingService.loadDuckingRules(routingConfig.ducking);
        logger.info('Ducking rules loaded from routing config', { count: routingConfig.ducking.length });
      }
    } catch (err) {
      logger.warn('Failed to load ducking rules - ducking engine will be inactive', { error: err.message });
    }

    logger.info('Phase 1 services initialized (game clock, cue engine, sound)');

    // Initialize VLC service only if video playback is enabled
    if (config.features.videoPlayback) {
      // Add error handler to prevent crashes from VLC connection failures
      vlcService.on('error', (error) => {
        logger.error('VLC service error (non-fatal)', error);
        logger.info('System will continue without video playback functionality');
      });

      try {
        await vlcService.init();
        await vlcService.initializeIdleLoop();
      } catch (error) {
        logger.warn('VLC service initialization failed - continuing without video playback', error);
      }

      // Display control initializes regardless of VLC status.
      // It manages Scoreboard mode (Chromium) independently of VLC.
      // VLC and videoQueueService are optional dependencies (null-checked internally).
      await displayControlService.init({ vlcService, videoQueueService });
      logger.info('Display control service initialized');
    } else {
      logger.info('VLC service disabled - video playback feature is off');
    }
    
    // Check for restored session on startup
    const currentSession = sessionService.getCurrentSession();
    if (currentSession) {
      logger.info('Session loaded on startup', {
        sessionId: currentSession.id,
        status: currentSession.status,
      });
    } else {
      logger.info('No previous session - ready for new game');
    }
    
    // Start periodic health revalidation (catches stale services like pipewire-pulse)
    serviceHealthRegistry.startRevalidation({
      vlc: vlcService,
      music: musicService,
      sound: soundService,
      bluetooth: bluetoothService,
      audio: audioRoutingService,
      lighting: lightingService,
    }, 15000);

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