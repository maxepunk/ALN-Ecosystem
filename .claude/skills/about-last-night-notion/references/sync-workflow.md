# Notion to tokens.json Sync Workflow

This document provides complete documentation for synchronizing the Notion Elements database to the `tokens.json` file used by the ALN memory token scanners.

## Overview

The sync workflow transforms Notion Elements database entries into a structured JSON file that scanners use to display memory tokens. The process:

1. Queries Notion for Memory Token elements (Image, Audio, Video, Audio+Image types)
2. Parses SF_ fields from the Description/Text property using regex patterns
3. Extracts display text (content BEFORE SF_ fields) for NeurAI display generation
4. Generates 240x320 NeurAI-styled BMP images for tokens with display text
5. Checks filesystem for existing media assets (images, audio, video)
6. Builds tokens.json with proper structure and relationships
7. Writes to `ALN-TokenData/tokens.json` (shared via git submodule)

## SF_ Field Format (CRITICAL)

### Notion Description/Text Property Structure

Memory Token elements in Notion use a special format in the **Description/Text** property:

```
Display text for scanners goes here.
This will be shown on NeurAI screens when scanned.

SF_RFID: [tokenId]
SF_ValueRating: [1-5]
SF_MemoryType: [Personal|Business|Technical]
SF_Group: [Group Name (xN)]
SF_Summary: [Optional summary for backend display]
```

**Key Principles:**

1. **Display Text FIRST**: Everything BEFORE the first "SF_" line becomes the display text shown on scanner screens
2. **SF_ Fields AFTER**: All SF_ fields come after display text, separated by blank line (recommended)
3. **Square Brackets**: All SF_ values MUST be in square brackets: `SF_RFID: [value]`
4. **Whitespace Tolerant**: Extra spaces allowed: `SF_RFID: [ value ]` works fine
5. **Case Insensitive**: Field names are case-insensitive (SF_RFID = sf_rfid = Sf_RfId)

### SF_ Field Specifications

#### SF_RFID (Required)
- **Type**: String
- **Format**: `SF_RFID: [tokenId]`
- **Rules**:
  - MUST be unique across all tokens
  - Converted to lowercase
  - Used as key in tokens.json
  - Used for asset file matching (e.g., `tokenId.bmp`, `tokenId.wav`)
- **Example**: `SF_RFID: [jaw001]`

#### SF_ValueRating (Optional)
- **Type**: Integer (1-5)
- **Format**: `SF_ValueRating: [3]`
- **Rules**:
  - Must be numeric 1-5
  - Used for scoring in backend
  - Defaults to `null` if missing or invalid
- **Example**: `SF_ValueRating: [5]`

#### SF_MemoryType (Optional)
- **Type**: String
- **Format**: `SF_MemoryType: [Personal]`
- **Valid Values**: `Personal`, `Business`, `Technical`
- **Rules**:
  - Used for categorization
  - Defaults to `null` if missing
- **Example**: `SF_MemoryType: [Technical]`

#### SF_Group (Optional)
- **Type**: String
- **Format**: `SF_Group: [Black Market Ransom (x2)]`
- **Rules**:
  - Used for group completion tracking
  - Format often includes "(xN)" indicating group size
  - Defaults to empty string `""` if missing
- **Example**: `SF_Group: [Funding Documents (x3)]`

#### SF_Summary (Optional)
- **Type**: String
- **Format**: `SF_Summary: [Brief summary text]`
- **Rules**:
  - Used for backend scoring display (shows longer description)
  - Only included in tokens.json if present
  - Not shown on scanner displays (use display text for that)
- **Example**: `SF_Summary: [Audio recording of heated argument between CEO and CFO]`

### Complete Example: Notion Entry

**Element Name**: "CEO Office Photo"

**Basic Type**: Memory Token Image

**Description/Text**:
```
A photograph showing the CEO's office with visible documents on the desk.

SF_RFID: [ceo_office_001]
SF_ValueRating: [4]
SF_MemoryType: [Business]
SF_Group: [Executive Suite (x5)]
SF_Summary: [Office photo reveals classified funding documents]
```

**Result:**
- **Display Text**: "A photograph showing the CEO's office with visible documents on the desk."
- **NeurAI BMP Generated**: Yes (saved to `assets/images/ceo_office_001.bmp`)
- **tokenId**: `ceo_office_001`

## Parsing Logic

The sync script uses regex patterns to extract SF_ fields:

```python
patterns = {
    'SF_RFID': r'SF_RFID:\s*\[([^\]]*)\]',
    'SF_ValueRating': r'SF_ValueRating:\s*\[([^\]]*)\]',
    'SF_MemoryType': r'SF_MemoryType:\s*\[([^\]]*)\]',
    'SF_Group': r'SF_Group:\s*\[([^\]]*)\]',
    'SF_Summary': r'SF_Summary:\s*\[([^\]]*)\]',
}
```

**Display Text Extraction:**
```python
display_text = description
if description:
    sf_start = description.find('SF_')
    if sf_start > 0:
        display_text = description[:sf_start].strip()
```

## NeurAI Display Generation

When a token has display text (text before SF_ fields), the sync script generates a 240x320 BMP image styled to match the NeurAI terminal aesthetic.

### Design Specifications

**Dimensions**: 240×320 pixels (portrait)
**Format**: 24-bit BMP
**Style**: Cyberpunk terminal with red accent branding

**Visual Elements:**
1. **Background**: Black (#0a0a0a)
2. **Red Glow Border**: 2px, rgba(204, 0, 0, 0.3)
3. **NeurAI ASCII Logo**: Top right, red (rgba(204, 0, 0, 0.4))
4. **Red Accent Line**: Horizontal line below logo
5. **Body Text**: White (#ffffff), word-wrapped, mono spaced font
6. **Truncation Indicator**: `[...]` in red if text too long
7. **Bottom Branding**: "N E U R A I" centered, red (rgba(204, 0, 0, 0.6))

### Font Requirements

**Primary Font**: DejaVu Sans Mono (monospace)
**Fallback**: Liberation Mono or default system font

**Font Sizes** (dynamic based on text length):
- **Long text** (>200 chars): 10pt, 15px line height
- **Medium text** (>150 chars): 12pt, 16px line height
- **Short text** (≤150 chars): 13pt, 18px line height

### Deployment Paths

Each generated BMP is saved to TWO locations:

1. **PWA Scanners**: `aln-memory-scanner/assets/images/{tokenId}.bmp`
2. **ESP32 Scanner**: `arduino-cyd-player-scanner/sd-card-deploy/images/{tokenId}.bmp`

### When Display Images Are Generated

- ✅ **Generated**: Token has display text (text before SF_ fields)
- ❌ **Not Generated**: No display text, only SF_ fields
- 🔄 **Overwritten**: Regenerated on every sync if display text exists

### Example: Generated vs Not Generated

**Generated (has display text)**:
```
Memory of late-night lab access.

SF_RFID: [lab_access_001]
```
→ Generates `lab_access_001.bmp` with "Memory of late-night lab access."

**Not Generated (no display text)**:
```
SF_RFID: [prop_item_042]
SF_ValueRating: [2]
```
→ No BMP generated, relies on existing asset or placeholder

## Asset File Matching

The sync script checks for existing media files using the SF_RFID:

### Image Assets
**Path**: `aln-memory-scanner/assets/images/`
**Extensions**: `.bmp`, `.jpg`, `.png`, `.jpeg`
**Matching**: Case-insensitive stem match (e.g., `JAW001.BMP` matches `jaw001`)

### Audio Assets
**Path**: `aln-memory-scanner/assets/audio/`
**Extensions**: `.mp3`, `.wav`, `.ogg`
**Matching**: Case-insensitive stem match

### Video Assets
**Path**: `backend/public/videos/`
**Extensions**: `.mp4`
**Matching**: Case-insensitive stem match
**Special**: Video filename only (not full path) stored in tokens.json

### Placeholder Fallback
If no image found and no NeurAI BMP generated:
```json
"image": "assets/images/placeholder.bmp"
```

## tokens.json Schema

### Regular Token (Image/Audio/Audio+Image)

```json
{
  "tokenId": {
    "image": "assets/images/tokenId.bmp",
    "audio": "assets/audio/tokenId.wav",
    "video": null,
    "processingImage": null,
    "SF_RFID": "tokenId",
    "SF_ValueRating": 3,
    "SF_MemoryType": "Personal",
    "SF_Group": "Group Name (x2)",
    "summary": "Optional summary text"
  }
}
```

### Video Token (Special Handling)

Video tokens have different structure:
- `image`: **null** (videos don't show images during playback)
- `processingImage`: Path to image shown WHILE video is queuing/processing
- `video`: Filename only (e.g., `tokenId.mp4`, NOT full path)

```json
{
  "video_token_001": {
    "image": null,
    "audio": null,
    "video": "video_token_001.mp4",
    "processingImage": "assets/images/video_token_001.bmp",
    "SF_RFID": "video_token_001",
    "SF_ValueRating": 5,
    "SF_MemoryType": "Business",
    "SF_Group": ""
  }
}
```

**processingImage Explained:**
When a video token is scanned:
1. Scanner shows the processingImage (generated NeurAI BMP or custom image)
2. Backend queues video for playback on main screen
3. Scanner returns to idle after showing processing screen

### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `image` | string\|null | Yes | Relative path to image asset, or null for video tokens |
| `audio` | string\|null | Yes | Relative path to audio asset, or null if none |
| `video` | string\|null | Yes | Video filename (not path), or null if not video token |
| `processingImage` | string\|null | Yes | Image shown while video queues (video tokens only) |
| `SF_RFID` | string | Yes | Unique token identifier (key in JSON) |
| `SF_ValueRating` | int\|null | No | Score value 1-5, or null if not rated |
| `SF_MemoryType` | string\|null | No | Category: Personal, Business, or Technical |
| `SF_Group` | string | No | Group identifier (empty string if not grouped) |
| `summary` | string | No | Only present if SF_Summary was provided |

## Complete Workflow Example

### 1. Notion Entry Setup

**Create Element in Notion:**
- **Name**: "Lab Access Card"
- **Basic Type**: Memory Token Audio + Image
- **Description/Text**:
  ```
  Scanned badge showing unauthorized lab access at 2:47 AM.

  SF_RFID: [lab_badge_047]
  SF_ValueRating: [4]
  SF_MemoryType: [Technical]
  SF_Group: [Security Breach (x3)]
  SF_Summary: [Badge data reveals timing of unauthorized entry]
  ```

**Add Media Files** (via Files & media property or manually):
- Image: `aln-memory-scanner/assets/images/lab_badge_047.bmp` (if custom, otherwise NeurAI generated)
- Audio: `aln-memory-scanner/assets/audio/lab_badge_047.wav`

### 2. Run Sync Script

```bash
export NOTION_TOKEN="your_notion_integration_token_here"
python3 scripts/sync_notion_to_tokens.py
```

### 3. Script Processing

1. **Queries Notion**: Fetches all Memory Token elements
2. **Parses Entry**:
   - Display text: "Scanned badge showing unauthorized lab access at 2:47 AM."
   - SF_RFID: `lab_badge_047`
   - SF_ValueRating: `4`
   - SF_MemoryType: `Technical`
   - SF_Group: `Security Breach (x3)`
   - SF_Summary: `Badge data reveals timing of unauthorized entry`
3. **Generates NeurAI BMP**: Creates `lab_badge_047.bmp` with display text (if not already exists)
4. **Finds Assets**:
   - Image: `assets/images/lab_badge_047.bmp` ✅
   - Audio: `assets/audio/lab_badge_047.wav` ✅
   - Video: Not found ❌
5. **Writes to tokens.json**

### 4. tokens.json Output

```json
{
  "lab_badge_047": {
    "image": "assets/images/lab_badge_047.bmp",
    "audio": "assets/audio/lab_badge_047.wav",
    "video": null,
    "processingImage": null,
    "SF_RFID": "lab_badge_047",
    "SF_ValueRating": 4,
    "SF_MemoryType": "Technical",
    "SF_Group": "Security Breach (x3)",
    "summary": "Badge data reveals timing of unauthorized entry"
  }
}
```

### 5. Git Submodule Update

```bash
# Commit to ALN-TokenData submodule
cd ALN-TokenData
git add tokens.json
git commit -m "sync: add lab_badge_047 token"
git push

# Update parent repo submodule reference
cd ..
git submodule update --remote --merge ALN-TokenData
git add ALN-TokenData
git commit -m "chore: update token data submodule"
git push
```

## Common Patterns

### Adding a New Memory Token

1. Create Element in Notion Elements database
2. Set Basic Type to appropriate memory token type
3. Add Description/Text with display text + SF_ fields
4. Optionally add media files to Files & media property
5. Run `python3 scripts/sync_notion_to_tokens.py`
6. Commit and push ALN-TokenData submodule
7. Update parent repo submodule reference

### Updating Display Text

1. Edit Element in Notion (Description/Text field)
2. Change text BEFORE SF_ fields
3. Run sync script
4. NeurAI BMP regenerated automatically
5. Commit and push changes

### Changing Token Metadata

To change SF_ValueRating, SF_Group, etc:
1. Edit Description/Text in Notion
2. Update SF_ field values in square brackets
3. Run sync script
4. Commit and push

### Debugging Missing Tokens

**Symptom**: Token doesn't appear in tokens.json

**Checklist**:
- [ ] Element has Basic Type set to Memory Token (Image/Audio/Video/Audio+Image)
- [ ] Description/Text contains `SF_RFID: [value]`
- [ ] RFID value is unique (not duplicate)
- [ ] Element is not archived/deleted in Notion
- [ ] Sync script ran without errors

**Common Errors**:
- ❌ `SF_RFID [value]` (missing colon)
- ❌ `SF_RFID: value` (missing brackets)
- ❌ Duplicate RFID (silently overwrites in JSON)

### Verifying Assets

After sync, check:

```bash
# Check tokens.json exists
ls -lh ALN-TokenData/tokens.json

# Check generated BMP count
ls -1 aln-memory-scanner/assets/images/*.bmp | wc -l
ls -1 arduino-cyd-player-scanner/sd-card-deploy/images/*.bmp | wc -l

# Check for missing assets
grep -o '"image": "[^"]*"' ALN-TokenData/tokens.json | while read line; do
  file=$(echo $line | cut -d'"' -f4)
  if [ "$file" != "null" ] && [ ! -f "aln-memory-scanner/$file" ]; then
    echo "Missing: $file"
  fi
done
```

## Troubleshooting

### Script Errors

**"Error: NOTION_TOKEN not found"**
```bash
export NOTION_TOKEN="your_token_here"
# Or add to .env file in project root
```

**"Database not found or not shared with integration"**
- Verify integration has access to Elements database
- Check database ID is correct: `18c2f33d-583f-8020-91bc-d84c7dd94306`

**"Failed to generate NeurAI display"**
- Install Pillow: `pip install pillow --break-system-packages`
- Check font availability: `ls /usr/share/fonts/truetype/dejavu/`

### Data Issues

**Token has no image**
- Check if display text exists (generates NeurAI BMP)
- Check if asset file exists in `aln-memory-scanner/assets/images/`
- Verify filename matches SF_RFID (case-insensitive)
- Falls back to `assets/images/placeholder.bmp` if available

**Video token not working**
- Ensure `image: null`, `processingImage: path` structure
- Verify video file in `backend/public/videos/{rfid}.mp4`
- Check backend video queue service logs

**Group not being tracked**
- Verify `SF_Group: [Name (xN)]` format with brackets
- Check backend transactionService group completion logic

## Best Practices

1. **Consistent Naming**: Use descriptive, lowercase RFID values (e.g., `ceo_photo_01`, not `Photo1`)
2. **Display Text First**: Always put scanner-facing text before SF_ fields
3. **Version Control**: Commit tokens.json to ALN-TokenData submodule immediately after sync
4. **Backup**: Keep Notion database backups before bulk changes
5. **Test Before Deploy**: Run sync script in dev environment first
6. **Asset Prep**: Add media files before syncing (or add NeurAI display text)
7. **Document Groups**: Maintain group naming consistency across related tokens
8. **Regular Syncs**: Sync frequently during content development to catch errors early

## Reference Files

- [elements-schema.md](elements-schema.md) - Complete Elements database schema
- [api-patterns.md](api-patterns.md) - Notion API usage patterns
- `scripts/sync_notion_to_tokens.py` - Complete implementation
