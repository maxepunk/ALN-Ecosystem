# ALN Tag Writer

Production utility PWA for programming NTAG215 NFC tags with dual-record format.

## Purpose

Programs NFC tags with two NDEF records:
1. **Text record** (first): Token ID for hardware/web scanners
2. **URL record** (second): Deep link for Android "tap to open" experience

## How Different Readers Handle Dual Records

| Reader | Behavior | Result |
|--------|----------|--------|
| **ESP32 (MFRC522)** | Parses NDEF, extracts first text record | Gets `kaa001` |
| **GM Scanner (Web NFC)** | Iterates records, returns first text match | Gets `kaa001` |
| **Player Scanner (Web NFC)** | Same as GM Scanner | Gets `kaa001` |
| **Android OS (no app open)** | Sees URL record, opens browser | Opens player scanner URL |

**Critical:** Text record MUST be first. URL record second.

## Usage

1. Open `index.html` on an Android device with Chrome (Web NFC required)
2. Select environment (Dev or Prod)
3. Click "Load Tokens" to fetch token database
4. Select tokens to program (default: all)
5. Click "Start Writing"
6. For each tag:
   - Place tag on device
   - Wait for write + verification
   - Remove tag when prompted
   - Tap "Next" for next token

## Write-Verify Workflow

Each tag goes through a **Write → Verify → Confirm** cycle:

1. **Write Phase**: Place tag, dual records written
2. **Verify Phase**: Automatic read-back and validation
3. **Result Phase**: Shows verification breakdown (text, URL, order)
4. **Next Phase**: Remove tag, advance to next token

## Environment URLs

| Environment | mDNS Hostname | Tag URL Base |
|-------------|---------------|--------------|
| **Dev (Pi 5)** | `raspberrypi` | `https://raspberrypi.local:3000/player-scanner/` |
| **Prod (Pi 4)** | `aln-orchestrator` | `https://aln-orchestrator.local:3000/player-scanner/` |

## Requirements

- Android device with NFC
- Chrome browser (Web NFC API)
- HTTPS connection (required for Web NFC)
- NTAG215 NFC tags

## Verification Checks

The tool validates:
- Text record present and matches expected token ID
- URL record present and contains token ID
- Text record is first (correct order for scanner compatibility)

## Troubleshooting

**"NFC not supported"**: Use Chrome on Android. iOS does not support Web NFC.

**Write fails**: Ensure tag is NTAG215 (not NTAG213 - too small). Keep tag steady during write.

**Verify fails**: Tag may have been moved during write. Use "Retry" to reprogram.

## Files

- `index.html` - Complete PWA (single file, no build required)
- `README.md` - This file
