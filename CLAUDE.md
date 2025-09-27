# ALN-Ecosystem Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-09-24

## Active Technologies
- Node.js 20+ or 22+ (backend orchestrator) + Express.js (HTTP API), Socket.io (WebSocket), axios (VLC control), node-persist (session storage)
- JavaScript ES2020+ (scanner integrations)
- JSON files (session persistence), localStorage (scanner state)

## Key Agent Prompting Principles

  1. Complete Context - Agents can't see what I see
  2. Exact Specifications - No ambiguity, no references to external docs
  3. Self-Contained Instructions - Everything needed in ONE prompt
  4. Verification Steps - Clear success criteria
  5. Error Handling - What to do if things go wrong

## Project Structure
```
ALN-Ecosystem/                  # Parent repository (this repo)
├── aln-memory-scanner/         # [SUBMODULE] Player scanner PWA
│   ├── data/                   # [NESTED SUBMODULE → ALN-TokenData]
│   ├── js/
│   │   └── orchestratorIntegration.js  # NEW: Orchestrator client
│   └── config.html             # NEW: Network setup page
├── ALNScanner/                 # [SUBMODULE] GM scanner web app
│   ├── data/                   # [NESTED SUBMODULE → ALN-TokenData]
│   └── js/
│       └── orchestratorWebSocket.js    # NEW: WebSocket client
├── ALN-TokenData/              # [SUBMODULE] Direct access for backend
├── backend/                    # [DIRECT FOLDER] Orchestrator server
│   ├── src/
│   │   ├── app.js             # Express application setup
│   │   ├── server.js          # Server entry point with WebSocket
│   │   ├── config/            # Configuration management
│   │   │   └── config.js      # CRITICAL: Must load from ALN-TokenData
│   │   ├── models/            # Data models
│   │   ├── services/          # Business logic services
│   │   │   ├── discoveryService.js     # NEW: Network flexibility
│   │   │   ├── sessionService.js
│   │   │   ├── stateService.js
│   │   │   ├── transactionService.js
│   │   │   ├── videoQueueService.js
│   │   │   ├── vlcService.js
│   │   │   └── syncService.js
│   │   ├── routes/            # HTTP API routes
│   │   ├── websocket/         # WebSocket handlers
│   │   └── utils/             # Utility functions
│   ├── public/
│   │   └── admin/             # Admin interface
│   ├── storage/               # Persistent data storage
│   ├── logs/                  # Application logs
│   ├── videos/                # Video files
│   └── package.json
├── hardware/                   # [FUTURE - Not in current scope]
│   └── esp32/                 # ESP32 scanner implementation
├── shared/                     # [DIRECT FOLDER] Shared utilities
├── scripts/                    # Setup and deployment scripts
└── specs/                      # System specifications
```

## Commands

### Git Submodule Management
```bash
# Initial setup with submodules
git clone --recurse-submodules https://github.com/[user]/ALN-Ecosystem.git

# Update all submodules to latest
git submodule update --init --recursive
git submodule update --remote --merge

# Configure scanner submodules (one-time)
git config --file=.gitmodules submodule.aln-memory-scanner.recurse true
git config --file=.gitmodules submodule.ALNScanner.recurse true
```

### Backend (ALN Orchestrator)
```bash
# Development
cd backend
npm install              # Install dependencies
npm run dev              # Start in development mode with hot reload
npm start                # Start production server

# Testing
npm test                 # Run all tests
npm test:contract        # Run contract tests only
npm test:integration     # Run integration tests only
npm test:unit           # Run unit tests only
npm run test:watch      # Run tests in watch mode

# Code Quality
npm run lint            # Run ESLint
npm run lint:fix        # Auto-fix linting issues
npm run format          # Format code with Prettier

# Storage Management
npm run storage:clear   # Clear all persistent storage
npm run storage:backup  # Backup session data
```

### Scanner Testing (Local)
```bash
# Player Scanner
cd aln-memory-scanner
python3 -m http.server 8000
# Access at http://localhost:8000
# Config at http://localhost:8000/config.html

# GM Scanner
cd ALNScanner
python3 -m http.server 8001
# Access at http://localhost:8001
```


### System Requirements
- Node.js 20+ or 22+ with ES6 modules support
- VLC Media Player (optional, system degrades gracefully without it)
- 100MB RAM minimum for Raspberry Pi deployment
- Port 3000 for HTTP/WebSocket server
- Git with submodule support

## Code Style

### Node.js 20+ or 22+ (backend orchestrator)
- ES6 modules with named exports
- Async/await for all asynchronous operations
- Singleton pattern for services
- Event-driven architecture with EventEmitter
- JSDoc comments for all public methods
- Error codes: Use specific error codes (AUTH_REQUIRED, PERMISSION_DENIED, etc.)
- Response format: `{ status: 'success'|'error', data?, error? }`

### JavaScript (scanner integrations)
- Progressive enhancement pattern - works without orchestrator
- localStorage for configuration persistence
- Offline queue with automatic retry
- Connection status indicators required
- WebSocket for GM stations, HTTP for player scanners


## Integration Requirements

### CRITICAL: Token Loading
- Backend MUST load tokens from ALN-TokenData submodule
- NO hardcoded tokens in backend/src/config/config.js
- Use filesystem loading with fallback paths

### Network Flexibility
- System MUST work on any network without router configuration
- Dynamic IP support with DHCP
- Multiple discovery methods (mDNS, UDP broadcast, manual config)
- Configuration page required for all scanners

### Submodule Structure
- Scanner repos remain independent with GitHub Pages deployment
- ALN-TokenData nested in scanner data/ folders
- Backend reads directly from ALN-TokenData/tokens.json
- Recursive submodule updates required

## Recent Changes
- 001-aln-video-playback: Complete integration phase - submodule configuration, network flexibility, scanner clients, admin interface

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
