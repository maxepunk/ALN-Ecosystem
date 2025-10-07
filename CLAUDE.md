# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

The ALN (About Last Night) Ecosystem is a memory token scanning and video playback system for about last night, a 2 hour immersive game about unlocking and trading in memory tokens containing game characters' lost memories. It is a live event that is run one iteration at a time, either using github pages deployments of player and gm scanners in standalone mode, or using the backend orchestrator to enable syncing across devices and additional features like VLC video playback. It consists of:
- **Memory Tokens** - RFID tags with IDs corresponding to the keys from tokens.json. Players scan then to get associated media content, and turn them into GMs to be scanned for game logic calculations/scoring. (SUBMODULE: ALN-TokenData) 
- **Backend Orchestrator**: Node.js server managing video playback, sessions, and state. Used when available; when not, scanners operate independently via deployment on Github Pages. 
- **Scanner Apps**: Web-based token scanners (Player and GM) with WebSocket/HTTP integration
  --**Player Scanner**: Uses HTTP endpoints, simple scan logging, display of local assets if token contains audio or image content, and triggering of video files for tokens containing video content (IF orchestrator is present) on separate screen controlled by the orchestrator. intended for players to discover and use as a tool to see the narrative contents of in-game memory tokens. Can operate WITH orchestrator OR WITHOUT in standaalone mode (no video playback). (SUBMODULE: aln-memory-scanner, aka ALNPlayerScan)
  --**GM Scanner**: Uses Websocket after HTTP handshake. Responsible for game logic. Can function in networked mode (in communcation with orchestrator) or standalone. Detective Mode scans and logs tokens (future feature: create player-facing log of narrative events that have been 'made public' by being scanned by the Detective Mode scanner) that were 'turned into' (scanned by) the GM playing the Detective. Black Market Mode scans tokens and handles scoring calculations using scanner/team number for score assignment, by parsing token scoring information from tokens.jason and doing the relevant calculations to keep team scores up to date for each play session.  (SUBMODULE: ALNScanner)
- **VLC Integration**: Video display on TV/monitor via VLC HTTP interface
- **Submodule Architecture**: Shared token data across modules.

**API CONTRACT** /home/spide/projects/AboutLastNight/ALN-Ecosystem/backend/contracts/openapi.yaml

**EVENT CONRACT** /home/spide/projects/AboutLastNight/ALN-Ecosystem/backend/contracts/asyncapi.yaml

## Critical Architecture Decisions

### Submodule Structure
The project uses Git submodules for code and data sharing:
```
ALN-Ecosystem/                     # Parent repository
├── aln-memory-scanner/            # [SUBMODULE] Player scanner PWA
│   └── data/                      # [NESTED SUBMODULE → ALN-TokenData]
├── ALNScanner/                    # [SUBMODULE] GM scanner web app
│   └── data/                      # [NESTED SUBMODULE → ALN-TokenData]
├── ALN-TokenData/                 # [SUBMODULE] Token definitions (backend direct access)
└── backend/                       # [DIRECT FOLDER] Orchestrator server
```

### Token Data Loading
- Backend MUST load tokens from `ALN-TokenData/tokens.json` submodule
- NO hardcoded tokens in backend configuration
- Token paths differ by media type:
  - Videos: `"video": "filename.mp4"` → Played from `backend/public/videos/`
  - Images/Audio: `"image": "assets/images/file.jpg"` → Scanner local files

### Network Flexibility
- System works on ANY network without router configuration
- Uses UDP discovery broadcast (port 8888) for auto-detection
- Supports manual configuration fallback
- Scanners work independently via GitHub Pages when orchestrator unavailable

## Key Commands

### Development
```bash
cd backend
npm run dev                # Interactive development mode selector
npm run dev:full          # VLC + orchestrator with hot reload
npm run dev:no-video      # Orchestrator only (no VLC)
npm test                  # Run all tests
npm run lint              # Run ESLint
```

### Production
```bash
cd backend
npm start                 # Start with PM2 (VLC + orchestrator)
npm run prod:status       # Check PM2 processes
npm run prod:logs         # View logs
npm run prod:restart      # Restart all services
```

### Testing
```bash
npm test                              # All tests (271 tests)
npm run test:contract                 # Contract tests only (96 tests)
npm run test:integration              # Integration tests
npm run test:watch                    # Watch mode
npm run test:coverage                 # Coverage report
```

### Submodule Management
```bash
git submodule update --init --recursive    # Initialize all submodules
git submodule update --remote --merge      # Update to latest
npm run sync:quick                          # Quick sync and commit
```

### Health Checks
```bash
npm run health            # Full system health check
npm run health:api        # Check orchestrator API
npm run health:vlc        # Check VLC status
```

## Core Services Architecture

### Service Singleton Pattern
All services in `backend/src/services/` use singleton pattern with getInstance():
- **sessionService**: Active session management
- **stateService**: Global state coordination
- **videoQueueService**: Video playback queue
- **vlcService**: VLC control interface
- **transactionService**: Token scan transactions
- **discoveryService**: UDP broadcast for auto-discovery
- **offlineQueueService**: Offline scan queue management

### WebSocket Event Flow
/home/spide/projects/AboutLastNight/ALN-Ecosystem/backend/contracts/asyncapi.yaml

### API Response Format
/home/spide/projects/AboutLastNight/ALN-Ecosystem/backend/contracts/openapi.yaml

## Environment Configuration

### Required Variables
```env
NODE_ENV=development|production
PORT=3000
VLC_PASSWORD=vlc              # Must match VLC --http-password
FEATURE_VIDEO_PLAYBACK=true
```

### Critical Settings
- `VLC_PASSWORD` must be exactly `vlc`, not `vlc-password`
- `HOST=0.0.0.0` for network access
- `DISCOVERY_PORT=8888` for UDP broadcast

## Common Development Tasks

### Adding a New Token
1. Edit `ALN-TokenData/tokens.json`
2. Video: Add file to `backend/public/videos/`, use filename only
3. Images: Add to `ALN-TokenData/assets/images/`, use `assets/images/` path
4. Commit ALN-TokenData changes
5. Update parent repo submodule reference

### Testing Video Playback
```bash
# Start system
cd backend && npm run dev:full

# Trigger test scan
curl -X POST http://localhost:3000/api/scan \
  -H "Content-Type: application/json" \
  -d '{"tokenId": "534e2b03", "teamId": "001", "deviceId": "test"}'
```


### File Path Resolution
```javascript
// Token data always from submodule
path.join(__dirname, '../ALN-TokenData/tokens.json')

// Videos from public folder
path.join(__dirname, '../public/videos', videoFilename)

// Persistent storage
path.join(__dirname, '../data')
```

## Deployment Notes

### PM2 Ecosystem
The `ecosystem.config.js` manages both processes:
- `aln-orchestrator`: Node.js server
- `vlc-http`: VLC with HTTP interface

### Raspberry Pi Specifics
- Memory limit: 256MB max
- Use `NODE_OPTIONS=--max-old-space-size=256`
- Ensure HDMI output configured in `/boot/config.txt`
- VLC needs GUI access (`--intf qt`)

### Network Access URLs
- Orchestrator: `http://[IP]:3000`
- Admin Panel: `http://[IP]:3000/admin/`
- Player Scanner: `http://[IP]:3000/player-scanner/`
- GM Scanner: `http://[IP]:3000/gm-scanner/`
- VLC Control: `http://[IP]:8080` (password: vlc)

## Troubleshooting Quick Reference

| Issue | Solution |
|-------|----------|
| VLC not connecting | Check `VLC_PASSWORD=vlc` in .env |
| Video not playing | Verify file exists in `backend/public/videos/` |
| Scanner can't connect | Check firewall, use IP not localhost |
| Token not found | Update ALN-TokenData submodule |
| Port in use | `lsof -i :3000` and kill process |

## Code Style Guidelines

- ES6 modules with async/await
- Singleton services with getInstance()
- JSDoc comments for public methods
- Error codes for API responses
- Event-driven architecture with EventEmitter
- No console.log, use winston logger

