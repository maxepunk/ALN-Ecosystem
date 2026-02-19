# ALN Config Tool

A web-based configuration interface for the About Last Night game system. Allows GMs and show designers to set up venues, tune game economy, author show cues, manage audio routing, and save/restore configuration presets — without editing raw config files.

## Quick Start

```bash
cd config-tool
npm install
npm start
# Open http://localhost:9000
```

For development with auto-reload:

```bash
npm run dev
```

The default port is 9000. Set `CONFIG_PORT` environment variable to change it.

## What It Configures

The config tool reads and writes four config sources:

| Config Source | File Path | Description |
|---------------|-----------|-------------|
| Backend .env | `backend/.env` | Server settings, features, secrets |
| Scoring Config | `ALN-TokenData/scoring-config.json` | Base values and type multipliers |
| Cue Definitions | `backend/config/environment/cues.json` | Show control cues and timelines |
| Audio Routing | `backend/config/environment/routing.json` | Stream routing and ducking rules |

It also manages:
- Sound files in `backend/public/audio/`
- Video files in `backend/public/videos/`
- Named configuration presets in `config-tool/presets/`

Changes take effect when the backend is restarted (for .env changes) or immediately (for JSON config files that are loaded at runtime).

## Sections

### Game Economy

Tune how much tokens are worth in Black Market mode.

**Base Values** — Set the dollar value for each star rating (1-5 stars). These are the base prices before type multipliers are applied.

**Type Multipliers** — Set the multiplier for each memory type (Personal, Business, Technical). The formula is:

```
tokenScore = baseValues[rating] × typeMultipliers[type]
```

The formula preview updates live as you change values, showing example calculations.

**Token Browser** — Read-only table of all 48 tokens with filters by type, rating, group, and search. The "Value" column shows the calculated Black Market price using your current scoring settings. This data comes from `ALN-TokenData/tokens.json` and cannot be edited here (use the Notion sync scripts instead).

### Show Control

Author and edit cues that drive the automated show control system (sound, lighting, video, Spotify).

**Cue List (left panel)** — Lists all cues with filter dropdown:
- **All Cues** — Shows everything
- **Quick Fire (Manual)** — Cues the GM triggers from the admin panel
- **Standing (Event)** — Cues that fire automatically when a game event occurs
- **Standing (Clock)** — Cues that fire at specific game clock times
- **Compound (Timeline)** — Multi-step cues with timed entries

Use **+ New** to create a cue, **Dup** to duplicate the selected cue, and **Del** to delete (with warning if other cues reference it). Drag cues to reorder.

**Cue Editor (right panel)** — When a cue is selected:

- **Identity** — Set the cue label, icon, and "Fire Once" flag
- **Trigger Mode** — Choose Manual (GM button only), Automatic (event/clock triggered), or Both
  - **Event triggers** select from 13 game events (Token Processed, Video Completed, Group Completed, etc.) with optional conditions (e.g., "when valueRating >= 4")
  - **Clock triggers** fire at a specific game elapsed time (HH:MM:SS format)
  - **Conditions** support operators: equals, not equals, greater than, at least, less than, at most, is one of
- **Sequential Commands** — Ordered list of actions to execute. Each command has a dynamic form based on the action type. Use the categorized dropdown to pick an action (Sound, Lighting, Video, Spotify, Audio, Cue, Display).
- **Timeline** (compound cues) — Visual timeline with color-coded blocks. Drag blocks to reposition (snaps to 0.5s). Use the zoom slider to adjust scale. Each entry has an "at" time (in seconds) and an action with payload. Click the pencil icon on an entry to expand inline editing.
- **Routing Override** — Override the global audio routing for this cue's commands (sound → sink, video → sink, spotify → sink). Leave as "(default)" to use the global routing.
- **Convert** button at the bottom switches between sequential and timeline modes.

**Picker fields** in command forms:
- Sound/Video pickers list files from the backend with an "Upload new..." option that opens a file dialog
- Cue pickers list all other cues in the current config
- Sink pickers offer: (default), hdmi, bluetooth, combine-bt

**Asset Manager (bottom of left panel)** — Browse, upload, preview, and delete sound and video files. Shows which cues use each file. Sound files can be previewed with the play button.

### Audio & Environment

Configure audio routing, ducking, Bluetooth, and lighting.

**Stream Routing** — For each audio stream (video, spotify, sound), set the primary and fallback output sink. Options: hdmi, bluetooth, combine-bt. The "Default Output" dropdown sets the global default.

**Ducking Rules** — Automatically reduce one stream's volume when another is playing. Each rule specifies:
- **When** — The triggering stream (e.g., "video")
- **Duck** — The stream to reduce (e.g., "spotify")
- **To** — Target volume percentage (0-100%)
- **Fade** — Transition time in milliseconds

**Bluetooth** — Set scan and connection timeout durations.

**Lighting (Home Assistant)** — Enable/disable lighting integration, set the Home Assistant URL and access token, and toggle Docker container auto-management.

### Infrastructure

Edit all backend `.env` variables organized into collapsible groups:

- **Server** — NODE_ENV, PORT, HOST, CORS
- **HTTPS** — SSL certificate paths, HTTP redirect port
- **Security** — JWT secret/expiry, admin password (password fields with show/hide toggle)
- **VLC** — VLC host, port, password, reconnection settings
- **Session** — Max players, duplicate window, session timeout
- **Storage** — Data/logs directories, backup interval
- **Rate Limiting** — Request window and max requests
- **WebSocket** — Ping timeout/interval, max payload
- **Logging** — Log level, format, file rotation
- **Game** — Transaction history limits
- **Feature Flags** — Toggle offline mode, video playback, admin panel, debugging, idle loop

Click a group heading to expand/collapse it. The Server group is expanded by default.

### Presets

Save and restore complete venue configurations.

**Save Current** — Saves all four config sources (env, scoring, cues, routing) as a named preset file. Enter a name and optional description.

**Load** — Restores a preset, overwriting all config files. An automatic backup is created before loading so you can always recover. After loading, all sections refresh with the new data.

**Export** — Downloads the preset as a JSON file for sharing or backup.

**Import** — Upload a previously exported preset JSON file.

**Delete** — Removes a preset (with confirmation). Auto-backup presets (prefixed with `_backup_`) cannot be deleted through the UI.

## Save Workflow

1. Make changes in any section
2. The toolbar shows "Unsaved changes" with a pulsing amber dot
3. Click **Save** to write changes to disk
4. A toast notification confirms success or reports errors
5. If you navigate away with unsaved changes, a browser confirmation dialog warns you

Each section saves independently — saving in Game Economy only writes `scoring-config.json`, not the `.env` or cues.

## Validation

The Show Control section validates before saving:
- Every cue must have a non-empty label
- No cue can have both `commands` and `timeline` (must be one or the other)
- No duplicate cue IDs
- Clock trigger values must be valid HH:MM:SS
- Warnings (non-blocking) if a referenced sound or video file doesn't exist on disk

## Architecture

```
config-tool/
├── server.js              # Express server (port 9000)
├── lib/
│   ├── envParser.js       # .env file parser (round-trip safe)
│   ├── configManager.js   # Reads/writes all config sources
│   └── routes.js          # REST API endpoints
├── public/
│   ├── index.html         # SPA shell
│   ├── css/styles.css     # Full design system
│   └── js/
│       ├── app.js         # SPA controller (navigation, save, dirty state)
│       ├── utils/
│       │   ├── api.js     # Fetch-based API client
│       │   └── formatting.js  # Currency, date, file size, DOM helper
│       ├── sections/      # One module per sidebar section
│       │   ├── economy.js
│       │   ├── showcontrol.js
│       │   ├── audio.js
│       │   ├── infra.js
│       │   └── presets.js
│       └── components/    # Reusable UI components
│           ├── cueEditor.js
│           ├── conditionBuilder.js
│           ├── commandForm.js
│           ├── timelineView.js
│           ├── tokenBrowser.js
│           └── assetManager.js
├── presets/               # Saved preset files (gitignored)
└── tests/
    ├── envParser.test.js
    └── configManager.test.js
```

No build step required — vanilla JS served directly via ES modules (`<script type="module">`).

## API Reference

All endpoints are under `/api/`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/config` | Read all config sources |
| PUT | `/api/config/env` | Update .env values (partial — only sends changed keys) |
| PUT | `/api/config/scoring` | Write scoring-config.json |
| PUT | `/api/config/cues` | Write cues.json |
| PUT | `/api/config/routing` | Write routing.json |
| GET | `/api/tokens` | Read token database (read-only) |
| GET | `/api/assets/sounds` | List sound files with cue usage |
| GET | `/api/assets/videos` | List video files with cue usage |
| POST | `/api/assets/sounds` | Upload sound file (multipart) |
| POST | `/api/assets/videos` | Upload video file (multipart) |
| DELETE | `/api/assets/:type/:filename` | Delete asset file |
| GET | `/api/presets` | List saved presets |
| POST | `/api/presets` | Save current config as preset |
| PUT | `/api/presets/:filename/load` | Load preset (auto-backup first) |
| DELETE | `/api/presets/:filename` | Delete preset |
| GET | `/api/presets/:filename/export` | Export preset as JSON download |
| POST | `/api/presets/import` | Import preset from uploaded JSON |

## Running Tests

```bash
cd config-tool
npm test
```

Uses Node.js built-in test runner (27 tests covering env parsing, config management, presets, and asset operations).

## Security Notes

- File uploads are restricted by extension (.wav/.mp3 for sounds, .mp4 for videos) and size (50MB sounds, 2GB videos)
- Path traversal is prevented via `path.basename()` on all user-supplied filenames
- Preset imports validate required fields before writing
- The config tool should only be run on the local network — it has no authentication
