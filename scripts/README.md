# Notion Sync Scripts

This directory contains scripts for syncing the Notion Elements database with the `ALN-TokenData/tokens.json` file.

## Scripts

### 1. `sync_notion_to_tokens.py`

**Purpose:** Syncs Notion Elements database to `tokens.json`

**What it does:**
- Queries Notion for all Memory Token elements (`Memory Token`, `Memory Token Audio`, `Memory Token Video`, `Memory Token Audio + Image` Basic Types)
- Parses SF_ fields from the Description/Text field in Notion
- Checks filesystem for corresponding image/audio/video assets
- Generates NeurAI display BMPs for tokens with display text
- Uses `placeholder.bmp` for tokens without specific image assets
- Runs a **validation pass** before writing (see Validation below) and prints a summary
- Writes `ALN-TokenData/tokens.json` **atomically** (tmp + fsync + rename)
- Reports (or, with `--prune`, deletes) orphaned asset files
- Regenerates the ESP32 asset manifest (`aln-memory-scanner/assets/manifest.json`)

**Failure posture (IMPORTANT):**

Any incomplete Notion fetch — HTTP error, auth failure, rate limit that
survives retries, missing `results`, broken pagination — **aborts with exit
code 1**. Nothing is written and nothing is deleted. This protects against
the failure mode where a partial fetch silently shrinks tokens.json and
deletes asset files for the "missing" tokens.

Requests use a 30s timeout and retry with backoff on 429/5xx (honoring
`Retry-After`).

**Flags:**

| Flag | Effect |
|------|--------|
| *(none)* | Full sync; orphaned assets are **reported only**, never deleted |
| `--prune` | Actually delete orphaned asset files (only ever runs after a verifiably complete fetch) |
| `--dry-run` | Fetch + validate only: no tokens.json write, no BMP generation, no prune, no manifest |
| `--force` | Proceed with partial Notion data despite fetch failures (**DANGEROUS** — can shrink tokens.json) |

**Asset pruning:** every sync run computes the set of image/audio files whose
tokenId is no longer in Notion. By default these are only *listed* ("would
remove ..."). Pass `--prune` to delete them. `placeholder.bmp` is explicitly
exempt from both pruning and the ESP32 manifest (see
`generate_asset_manifest.EXEMPT_STEMS`).

**Validation pass (pre-write):**
- `SF_MemoryType` checked against `ALN-TokenData/scoring-config.json` `typeMultipliers` keys — a misspelled or wrong-case type scores 0x in-game, so it's flagged loudly
- `SF_ValueRating` checked for the 1-5 range (and missing/non-numeric values)
- Duplicate `SF_RFID` across two Notion pages is reported with both page titles (last processed wins)
- RFID↔file alignment: asset files whose stem matches no token SF_RFID are reported (likely filename/RFID mismatches), as are tokens with no assets at all

All validation findings are **warnings** — they're printed in a summary block
before the write but do not block the sync.

**Requirements:**
- Python 3
- `pip install -r scripts/requirements.txt` (requests, Pillow, python-dotenv)
- Notion API token (see Setup below)

**Setup:**

Set your Notion integration token via the project `.env` file (project root)
or an environment variable:
```bash
export NOTION_TOKEN="your_notion_token_here"
```

**Usage:**
```bash
cd ALN-Ecosystem
python3 scripts/sync_notion_to_tokens.py             # sync, report orphans
python3 scripts/sync_notion_to_tokens.py --dry-run   # preview only
python3 scripts/sync_notion_to_tokens.py --prune     # sync + delete orphans
```

**Output:**
- Updates `ALN-TokenData/tokens.json` (atomic write)
- Regenerates `aln-memory-scanner/assets/manifest.json`
- Shows progress, a validation summary, and orphan report during sync

### 2. `generate_asset_manifest.py`

**Purpose:** Regenerate the ESP32 asset manifest from whatever is already on
disk (no Notion access). Useful for bootstrapping when the sync hasn't run
recently. Also used as a library by the sync script (`build_manifest`,
`write_manifest`, `prune_orphans`).

```bash
python3 scripts/generate_asset_manifest.py
```

> The former `compare_rfid_with_files.py` QA tool has been removed — its
> RFID↔file mismatch check now runs inside `sync_notion_to_tokens.py` as
> part of the pre-write validation summary (and `--dry-run` gives you the
> report without touching anything).

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
- If no specific image file is found for a token (and no NeurAI BMP was generated), the script uses `assets/images/placeholder.bmp`
- `placeholder.bmp` itself is exempt from pruning and from the ESP32 manifest via an explicit exempt list (`generate_asset_manifest.EXEMPT_STEMS`)
- Placeholder is only applied to the `image` field, not to `processingImage`

**Special handling for video tokens:**
- If a video file exists AND an image file exists:
  - `video`: Set to filename (e.g., "jaw011.mp4")
  - `processingImage`: Set to image path (shown while video loads)
  - `image`: Set to `null` (video tokens don't use the image field)

## Fixing RFID/Filename Mismatches

The validation summary flags asset files whose name matches no token SF_RFID.
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

## Workflow

### Regular Sync

1. Update token data in Notion Elements database
2. Preview: `python3 scripts/sync_notion_to_tokens.py --dry-run` — review the validation summary, fix any warnings in Notion
3. Run sync: `python3 scripts/sync_notion_to_tokens.py` (add `--prune` once you've reviewed the orphan report)
4. Commit changes to git:
   ```bash
   cd ALN-TokenData
   git add tokens.json
   git commit -m "sync: update tokens from Notion"
   git push
   ```
5. Update submodules in parent repos:
   ```bash
   cd .. # Back to ALN-Ecosystem
   git submodule update --remote --merge ALN-TokenData
   ```

## Technical Details

### Notion API

- Uses a Notion Integration Token from `NOTION_TOKEN` (env var or project `.env`)
- API Version: `2022-06-28` (for properties compatibility)
- Elements Database ID: `18c2f33d-583f-8020-91bc-d84c7dd94306`
- 30s request timeout; retry with backoff on 429/5xx (honors Retry-After)
- Non-text rich_text blocks (@mentions, equations) are skipped with a warning naming the page

### File Matching

- Case-insensitive filename matching
- Supports multiple image formats: BMP, JPG, PNG, JPEG
- Supports multiple audio formats: MP3, WAV, OGG
- Video format: MP4 only

### Filtering

Only processes Elements with these Basic Types:
- Memory Token
- Memory Token Audio
- Memory Token Video
- Memory Token Audio + Image

Other element types (Props, Set Dressing, Documents, etc.) are ignored.

## Tests

```bash
cd scripts
pip install -r requirements.txt pytest
python3 -m pytest tests/
```

Covers the pure parsing functions, the abort-on-incomplete-fetch posture,
prune gating, validation warnings, placeholder exemption, and atomic writes.

## Future Improvements

1. **Two-way sync:** Update Notion when files are added/removed
2. **Automatic RFID detection:** Extract RFID from Notion file attachments
3. **Backup:** Create backup of tokens.json before overwriting

## Troubleshooting

### "ModuleNotFoundError: No module named 'requests'"

```bash
pip install -r scripts/requirements.txt
```

### "ABORTING: Notion fetch incomplete"

The sync refused to write because it couldn't verify it received the complete
token set. Check network connectivity, the integration token's access to the
Elements and Characters databases, and the database IDs. `--force` overrides
(dangerous — see Flags above).

### Files not detected

1. Check file naming matches SF_RFID exactly (case-insensitive)
2. Verify file extensions are supported (.bmp, .jpg, .png for images)
3. Check file permissions
4. Run with `--dry-run` and review the validation summary for mismatches

### Empty tokens.json

1. Verify Notion token has access to the Elements database
2. Check Elements database ID is correct
3. Ensure Elements have Basic Type set to Memory Token types
4. Verify SF_ fields are present in Description/Text fields
