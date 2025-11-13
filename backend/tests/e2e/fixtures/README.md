# E2E Test Fixtures

> **⚠️ DEPRECATION NOTICE (November 2025)**
>
> **Tests now primarily use dynamic production data** via the `helpers/token-selection.js` helper instead of these static fixtures. This ensures tests work with any token dataset and validate production scoring logic.
>
> **Current Status:**
> - ✅ **07a, 07b, 07c tests**: Now use dynamic token selection from `/api/tokens`
> - ⏳ **Session/infrastructure tests**: Still use fixtures (migration pending)
>
> **When to use fixtures:**
> - Tests requiring specific controlled scenarios (e.g., exact group compositions)
> - Tests where production data variability would cause flakiness
> - Unit/integration tests where mocking backend is preferred
>
> **When to use dynamic tokens (recommended):**
> - Scoring validation tests (ensures production logic works)
> - Transaction flow tests (data-agnostic patterns)
> - Any test that can work with arbitrary token data
>
> See `../helpers/token-selection.js` and `../README.md` for migration guide.

This directory contains minimal test data optimized for fast E2E test execution. All files are lightweight (< 1MB total) to ensure quick test runs.

## Purpose

E2E tests require token data and media files to validate the full system flow. Rather than using the production ALN-TokenData (100+ tokens, large videos), these fixtures provide:

- Fast test execution (small file sizes)
- Predictable test data (known token IDs and properties)
- Coverage of all token types (video, image, audio, combinations)
- Pi-compatible media encoding (H.264 YUV420p, low bitrate)

## Directory Structure

```
fixtures/
├── test-tokens.json           # 10 test tokens (2.6KB)
├── test-videos/               # Test video files (50KB total)
│   ├── test_10sec.mp4         # 10s blue video (12KB)
│   ├── test_30sec.mp4         # 30s green video (32KB)
│   └── idle_loop_test.mp4     # 5s red idle loop (6.6KB)
└── test-assets/
    ├── images/                # Test images (4 files, 1.2KB total)
    │   ├── test_image.jpg     # Purple 100x100 placeholder
    │   ├── test_video_01.jpg  # Gray processing image
    │   ├── test_video_02.jpg  # Gray processing image
    │   └── test_video_03.jpg  # Gray processing image
    └── audio/
        └── test_audio.mp3     # 5s 440Hz tone (40KB)
```

## Test Token Data

`test-tokens.json` contains 10 tokens covering all use cases:

### Video Tokens (3)
- `test_video_01`: 10s video, Personal, Group A, 5-star
- `test_video_02`: 30s video, Business, Group A, 4-star
- `test_video_03`: 10s video, Technical, Group B, 3-star

### Image-Only Tokens (2)
- `test_image_01`: Personal, no group, 2-star
- `test_image_02`: Business, Group B, 1-star

### Audio-Only Tokens (2)
- `test_audio_01`: Technical, no group, 3-star
- `test_audio_02`: Personal, Group B, 2-star

### Combo Token (1)
- `test_combo_01`: Image + Audio, Business, no group, 4-star

### Unknown Tokens (2)
- `test_unknown_01`: No media, Personal, 1-star
- `test_unknown_02`: No media, Technical, 1-star

## Test Groups

- **Group A (x2 multiplier)**: `test_video_01`, `test_video_02` (2 tokens)
- **Group B (x3 multiplier)**: `test_video_03`, `test_image_02`, `test_audio_02` (3 tokens)
- **No Group**: All others (5 tokens)

Use Groups A and B to test group completion bonuses in scoring tests.

## Media File Specifications

### Videos
All videos are H.264-encoded, YUV420p pixel format, optimized for Raspberry Pi hardware decoding:

- **Codec**: H.264 (libx264), profile main, level 4.0
- **Bitrate**: 500kbps (target), 600kbps (max)
- **Resolution**: 640x360 (16:9 aspect ratio)
- **Frame Rate**: 30fps
- **Color**: Solid colors for easy visual identification
  - `test_10sec.mp4`: Blue
  - `test_30sec.mp4`: Green
  - `idle_loop_test.mp4`: Red

### Images
- **Format**: JPEG
- **Size**: 100x100 pixels
- **Colors**:
  - `test_image.jpg`: Purple (for token display)
  - `test_video_*.jpg`: Gray (processing images for video tokens)

### Audio
- **Format**: MP3 (libmp3lame)
- **Duration**: 5 seconds
- **Tone**: 440Hz sine wave (A4 note)
- **Bitrate**: 64kbps mono

## Regenerating Media Files

If test media files become corrupted or need to be regenerated, use these ffmpeg commands:

### Regenerate Videos

```bash
cd backend/tests/e2e/fixtures/test-videos

# 10-second blue video
ffmpeg -f lavfi -i color=c=blue:s=640x360:r=30 -t 10 \
  -c:v libx264 -preset fast -profile:v main -level 4.0 \
  -b:v 500k -maxrate 600k -bufsize 1200k -pix_fmt yuv420p \
  -movflags +faststart test_10sec.mp4 -y

# 30-second green video
ffmpeg -f lavfi -i color=c=green:s=640x360:r=30 -t 30 \
  -c:v libx264 -preset fast -profile:v main -level 4.0 \
  -b:v 500k -maxrate 600k -bufsize 1200k -pix_fmt yuv420p \
  -movflags +faststart test_30sec.mp4 -y

# 5-second red idle loop
ffmpeg -f lavfi -i color=c=red:s=640x360:r=30 -t 5 \
  -c:v libx264 -preset fast -profile:v main -level 4.0 \
  -b:v 500k -maxrate 600k -bufsize 1200k -pix_fmt yuv420p \
  -movflags +faststart idle_loop_test.mp4 -y
```

### Regenerate Images

```bash
cd backend/tests/e2e/fixtures/test-assets/images

# Main test image (purple)
ffmpeg -f lavfi -i color=c=purple:s=100x100 -frames:v 1 -update 1 test_image.jpg -y

# Processing images for video tokens (gray)
ffmpeg -f lavfi -i color=c=gray:s=100x100 -frames:v 1 -update 1 test_video_01.jpg -y
ffmpeg -f lavfi -i color=c=gray:s=100x100 -frames:v 1 -update 1 test_video_02.jpg -y
ffmpeg -f lavfi -i color=c=gray:s=100x100 -frames:v 1 -update 1 test_video_03.jpg -y
```

### Regenerate Audio

```bash
cd backend/tests/e2e/fixtures/test-assets/audio

# 5-second 440Hz tone
ffmpeg -f lavfi -i "sine=frequency=440:duration=5" \
  -c:a libmp3lame -b:a 64k test_audio.mp3 -y
```

## Token Data Schema

The `test-tokens.json` file follows the exact schema used by ALN-TokenData:

```json
{
  "token_id": {
    "image": "assets/images/file.jpg" | null,
    "audio": "assets/audio/file.mp3" | null,
    "video": "filename.mp4" | null,
    "processingImage": "assets/images/file.jpg" | null,
    "SF_RFID": "token_id",
    "SF_ValueRating": 1-5,
    "SF_MemoryType": "Personal" | "Business" | "Technical",
    "SF_Group": "" | "Group Name (xN)"
  }
}
```

### Important Path Differences

- **Videos**: Reference filename only (e.g., `"test_10sec.mp4"`)
  - Backend serves from `backend/public/videos/`
  - For tests, copy to test video directory or mock VLC service
- **Images/Audio**: Full relative path from scanner root (e.g., `"assets/images/test_image.jpg"`)
  - Used by scanners for local display (no orchestrator needed)
  - Tests don't need these files unless testing scanner UI

## Using Fixtures in Tests

### ✨ Recommended: Dynamic Token Selection (New)

For most E2E tests, use dynamic production data instead of fixtures:

```javascript
const { selectTestTokens } = require('../helpers/token-selection');
const { calculateExpectedScore } = require('../helpers/scoring');

let testTokens = null;

test.beforeAll(async () => {
  testTokens = await selectTestTokens(orchestratorUrl);
});

test('should score token correctly', async () => {
  const token = testTokens.personalToken;
  const expectedScore = calculateExpectedScore(token);

  await scanner.manualScan(token.SF_RFID);
  const actualScore = await getTeamScore(page, '001', 'standalone');

  expect(actualScore).toBe(expectedScore);
});
```

**Benefits:**
- Works with any production token dataset
- Validates production scoring logic
- No hardcoded token IDs
- Easier maintenance

### Backend Unit Tests (Token Service)

```javascript
const tokenService = TokenService.getInstance();
const fixturesPath = path.join(__dirname, '../fixtures/test-tokens.json');
await tokenService.loadTokens(fixturesPath);
```

### Integration Tests (Full System)

```javascript
// Set environment variable before starting orchestrator
process.env.TOKEN_DATA_PATH = path.join(__dirname, '../fixtures/test-tokens.json');
process.env.VIDEO_PATH = path.join(__dirname, '../fixtures/test-videos');
```

### E2E Tests (Playwright) - Legacy Fixture Pattern

```javascript
// ⚠️ DEPRECATED: Use dynamic tokens for new tests (see above)
use: {
  baseURL: 'https://localhost:3000',
  extraHTTPHeaders: {
    'X-Test-Fixtures': 'true' // Signal to use test token data
  }
}
```

## Gitignore

These fixtures are committed to the repository (unlike production media). They are:
- Small enough for git (< 100KB total)
- Required for CI/CD test execution
- Safe to share (no copyrighted content)
- Reproducible via documented ffmpeg commands

## Maintenance

When updating token schema:
1. Update `test-tokens.json` to match new schema
2. Update tests that depend on token structure
3. Verify all 10 tokens still cover test cases
4. Keep media files small (< 1MB total)

## Related Documentation

- `docs/E2E_TEST_IMPLEMENTATION_PLAN.md`: Full E2E test architecture
- `ALN-TokenData/tokens.json`: Production token schema reference
- `backend/src/services/tokenService.js`: Token loading implementation
- `backend/contracts/openapi.yaml`: API contract for token endpoints
