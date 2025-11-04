# Notion Sync Scripts

This directory contains scripts for syncing the Notion Elements database with the `ALN-TokenData/tokens.json` file.

## Scripts

### 1. `sync_notion_to_tokens.py`

**Purpose:** Syncs Notion Elements database to `tokens.json`

**What it does:**
- Queries Notion for all Memory Token elements (Image, Audio, Video, Audio+Image types)
- Parses SF_ fields from the Description/Text field in Notion
- Checks filesystem for corresponding image/audio/video assets
- Uses `placeholder.bmp` for tokens without specific image assets
- Generates `ALN-TokenData/tokens.json` with proper structure

**Requirements:**
- Python 3
- `requests` library: `pip install requests --break-system-packages`
- Notion API token (see Setup below)

**Setup:**

Set your Notion integration token as an environment variable:
```bash
export NOTION_TOKEN="your_notion_token_here"
```

To make it permanent, add to your shell profile (~/.bashrc or ~/.zshrc):
```bash
echo 'export NOTION_TOKEN="your_notion_token_here"' >> ~/.bashrc
source ~/.bashrc
```

**Usage:**
```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem
python3 scripts/sync_notion_to_tokens.py
```

**Output:**
- Updates `ALN-TokenData/tokens.json`
- Shows progress and statistics during sync

### 2. `compare_rfid_with_files.py`

**Purpose:** Identifies mismatches between Notion SF_RFID values and actual filenames

**What it does:**
- Compares SF_RFID values in Notion descriptions with actual file prefixes
- Identifies tokens where the RFID doesn't match the filename
- Generates a detailed mismatch report

**Usage:**
```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem
python3 scripts/compare_rfid_with_files.py
```

**Output Example:**
```
✓ MATCHED (15 tokens)
tac001: TAC001 - Taylor's Drunk Confession Recording
  Files: tac001.bmp (image), tac001.wav (audio)

⚠️  MISMATCHES (5 tokens)
jaw011: JAW011 - James' Memory - Marcus entering 2nd room
  Notion SF_RFID: jaw011
  Notion Files: jaw001.bmp
  File Prefixes: jaw001
```

## Data Flow

### SF_ Fields in Notion

Memory Token elements in Notion contain SF_ fields in their Description/Text property, formatted as:

```
Template (Needs to be filled out)
SF_RFID: [jaw001]
SF_ValueRating: [5]
SF_MemoryType: [Personal]
SF_Group: [Black Market Ransom (x2)]
```

### tokens.json Structure

Each token entry has this structure:

```json
{
  "jaw001": {
    "image": "assets/images/jaw001.bmp",
    "audio": null,
    "video": "jaw001.mp4",
    "processingImage": "assets/images/jaw001.bmp",
    "SF_RFID": "jaw001",
    "SF_ValueRating": 5,
    "SF_MemoryType": "Personal",
    "SF_Group": "Black Market Ransom (x2)"
  }
}
```

### Asset Detection Logic

The sync script checks for assets in the following locations:

- **Images:** `aln-memory-scanner/assets/images/{RFID}.{bmp,jpg,png,jpeg}`
- **Audio:** `aln-memory-scanner/assets/audio/{RFID}.{mp3,wav,ogg}`
- **Videos:** `backend/public/videos/{RFID}.mp4`

**Placeholder image:**
- If no specific image file is found for a token, the script uses `assets/images/placeholder.bmp`
- This ensures all tokens have at least a placeholder image for the scanner UI
- Placeholder is only applied to the `image` field, not to `processingImage`

**Special handling for video tokens:**
- If a video file exists AND an image file exists:
  - `video`: Set to filename (e.g., "jaw011.mp4")
  - `processingImage`: Set to image path (shown while video loads)
  - `image`: Set to `null` (video tokens don't use the image field)

## Current Status

### All Tokens Synced ✅

As of the last sync, all 21 memory tokens are successfully synced:
- All RFID mismatches have been resolved (files renamed to match Notion SF_RFID values)
- All tokens have images (either specific assets or placeholder.bmp)
- The MAB001 token now has SF_RFID populated in Notion

**Tokens using placeholder.bmp:**
- Tokens without specific image assets automatically use `assets/images/placeholder.bmp`
- This provides a consistent scanner UI experience for all tokens

## Fixing Mismatches

You have two options:

### Option 1: Update Notion (Recommended)

Update the SF_RFID values in Notion descriptions to match filenames:

1. Open the Element in Notion
2. Find the Description/Text field
3. Update the line `SF_RFID: [wrong]` to `SF_RFID: [correct]`
4. Re-run `sync_notion_to_tokens.py`

### Option 2: Rename Files

Rename files to match Notion SF_RFID values:

```bash
# Example for jaw011 → jaw001 mismatch
mv aln-memory-scanner/assets/images/jaw001.bmp aln-memory-scanner/assets/images/jaw011.bmp
mv backend/public/videos/jaw001.mp4 backend/public/videos/jaw011.mp4
```

**Note:** If you rename files, you'll also need to update references in the backend and scanners.

## Workflow

### Regular Sync

1. Update token data in Notion Elements database
2. Run sync script: `python3 scripts/sync_notion_to_tokens.py`
3. Commit changes to git:
   ```bash
   cd ALN-TokenData
   git add tokens.json
   git commit -m "sync: update tokens from Notion"
   git push
   ```
4. Update submodules in parent repos:
   ```bash
   cd .. # Back to ALN-Ecosystem
   git submodule update --remote --merge ALN-TokenData
   ```

### Checking for Issues

Before syncing, run the comparison script to check for mismatches:

```bash
python3 scripts/compare_rfid_with_files.py
```

Fix any mismatches in Notion before running the sync.

## Technical Details

### Notion API

- Uses Notion Integration Token (hardcoded in scripts)
- API Version: `2022-06-28` (for properties compatibility)
- Elements Database ID: `18c2f33d-583f-8020-91bc-d84c7dd94306`

### File Matching

- Case-insensitive filename matching
- Supports multiple image formats: BMP, JPG, PNG, JPEG
- Supports multiple audio formats: MP3, WAV, OGG
- Video format: MP4 only

### Filtering

Only processes Elements with these Basic Types:
- Memory Token Image
- Memory Token Audio
- Memory Token Video
- Memory Token Audio + Image

Other element types (Props, Set Dressing, Documents, etc.) are ignored.

## Future Improvements

1. **Two-way sync:** Update Notion when files are added/removed
2. **Automatic RFID detection:** Extract RFID from Notion file attachments
3. **Validation:** Warn about tokens with ValueRating outside 1-5 range
4. **Backup:** Create backup of tokens.json before overwriting
5. **Dry run mode:** Preview changes before applying

## Troubleshooting

### "ModuleNotFoundError: No module named 'requests'"

Install required packages:
```bash
pip install requests notion-client --break-system-packages
```

### "KeyError: 'properties'" or API errors

The Notion API version may have changed. Check the API version in the script and update if needed.

### Files not detected

1. Check file naming matches SF_RFID exactly (case-insensitive)
2. Verify file extensions are supported (.bmp, .jpg, .png for images)
3. Check file permissions
4. Run `compare_rfid_with_files.py` to identify mismatches

### Empty tokens.json

1. Verify Notion token has access to the Elements database
2. Check Elements database ID is correct
3. Ensure Elements have Basic Type set to Memory Token types
4. Verify SF_ fields are present in Description/Text fields
