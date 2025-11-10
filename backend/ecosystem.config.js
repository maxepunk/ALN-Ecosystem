/**
 * PM2 Ecosystem Configuration
 * Production deployment configuration for ALN Orchestrator
 * Optimized for Raspberry Pi 4 (8GB RAM)
 */

module.exports = {
  apps: [
    {
      // Application configuration
      name: 'aln-orchestrator',
      script: './src/server.js',
      instances: 1, // Single instance for stateful WebSocket connections
      exec_mode: 'fork', // Fork mode for stateful application
      
      // Environment variables
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOST: '0.0.0.0',
        VLC_PASSWORD: 'vlc',
        VLC_HOST: 'localhost',
        VLC_PORT: 8080,
        ENABLE_HTTPS: 'true',
        SSL_KEY_PATH: './ssl/key.pem',
        SSL_CERT_PATH: './ssl/cert.pem',
        HTTP_REDIRECT_PORT: 8000,
      },

      env_development: {
        NODE_ENV: 'development',
        PORT: 3000,
        HOST: '0.0.0.0',
        DEBUG: 'true',
        VLC_PASSWORD: 'vlc',
        VLC_HOST: 'localhost',
        VLC_PORT: 8080,
        ENABLE_HTTPS: 'true',
        SSL_KEY_PATH: './ssl/key.pem',
        SSL_CERT_PATH: './ssl/cert.pem',
        HTTP_REDIRECT_PORT: 8000,
      },
      
      env_staging: {
        NODE_ENV: 'staging',
        PORT: 3000,
        HOST: '0.0.0.0',
      },
      
      // Process management
      watch: false, // Disable in production
      ignore_watch: ['node_modules', 'logs', 'data', '.git'],
      max_memory_restart: '2G', // Restart if memory exceeds 2GB (8GB Pi)
      
      // Logging
      log_file: './logs/combined.log',
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Restart behavior
      autorestart: true,
      min_uptime: '10s', // Minimum uptime to consider app started
      max_restarts: 10, // Maximum restarts within min_uptime
      
      // Graceful shutdown
      kill_timeout: 5000, // Time in ms before sending SIGKILL
      wait_ready: false, // Disabled - app doesn't send ready signal
      listen_timeout: 3000, // Time to wait for app to listen
      
      // Monitoring
      instance_var: 'INSTANCE_ID',
      
      // Node.js arguments
      node_args: '--max-old-space-size=2048', // 2GB max for 8GB Raspberry Pi
      
      // Cron restart (optional - restart daily at 3 AM)
      // cron_restart: '0 3 * * *',
      
      // Error handling
      combine_logs: true,
      
      // Development helpers (disabled in production)
      vizion: false, // Disable vizion features
      
      // Health check
      health_check: {
        interval: 30000, // 30 seconds
        url: 'https://localhost:3000/health',
        max_failures: 3,
      },
    },

    // VLC HTTP Interface Process (with video output, clean kiosk mode)
    {
      name: 'vlc-http',
      script: '/usr/bin/cvlc',
      // Optimized for RPi 4: Hardware decode via v4l2_m2m, PulseAudio for compatibility with PipeWire
      args: '--no-loop --intf http --http-password vlc --http-host 0.0.0.0 --http-port 8080 -A pulse --fullscreen --video-on-top --no-video-title-show --no-video-deco --no-osd --codec=avcodec --avcodec-hw=v4l2_m2m',
      interpreter: 'none', // Not a Node.js process
      exec_mode: 'fork',

      // Process management
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      max_restarts: 10,
      min_uptime: '10s',

      // Logging
      error_file: './logs/vlc-error.log',
      out_file: './logs/vlc-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      // Environment
      env: {
        DISPLAY: ':0', // For GUI support in WSL2/X11
      },

      // Graceful shutdown
      kill_timeout: 5000,

      // Disable features not needed for VLC
      vizion: false,
    },
  ],
  
  // Deploy configuration (optional)
  deploy: {
    production: {
      user: 'pi', // Raspberry Pi default user
      host: ['192.168.1.100'], // Replace with actual Pi IP
      ref: 'origin/main',
      repo: 'git@github.com:your-org/aln-ecosystem.git',
      path: '/home/pi/aln-orchestrator',
      'pre-deploy': 'git pull',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
      'pre-setup': 'mkdir -p /home/pi/aln-orchestrator',
    },
    
    staging: {
      user: 'deploy',
      host: ['staging.aln.local'],
      ref: 'origin/develop',
      repo: 'git@github.com:your-org/aln-ecosystem.git',
      path: '/var/www/aln-orchestrator-staging',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env staging',
    },
  },
};

/**
 * PM2 Commands Reference:
 * 
 * Start application:
 *   pm2 start ecosystem.config.js
 * 
 * Start in specific environment:
 *   pm2 start ecosystem.config.js --env production
 *   pm2 start ecosystem.config.js --env development
 * 
 * Management commands:
 *   pm2 status              # Show status
 *   pm2 logs                # Show logs
 *   pm2 logs --lines 100   # Show last 100 lines
 *   pm2 monit               # Real-time monitoring
 *   pm2 reload aln-orchestrator  # Zero-downtime reload
 *   pm2 restart aln-orchestrator # Hard restart
 *   pm2 stop aln-orchestrator    # Stop application
 *   pm2 delete aln-orchestrator  # Remove from PM2
 * 
 * Save configuration:
 *   pm2 save                # Save current process list
 *   pm2 startup             # Generate startup script
 * 
 * Deploy commands:
 *   pm2 deploy production setup    # Initial setup
 *   pm2 deploy production          # Deploy to production
 *   pm2 deploy production revert 1 # Revert to previous deployment
 * 
 * Monitoring:
 *   pm2 web                 # Start web monitoring (port 9615)
 *   pm2 plus                # Enhanced monitoring (requires account)
 */