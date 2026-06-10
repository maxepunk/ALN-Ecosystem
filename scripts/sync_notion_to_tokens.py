#!/usr/bin/env python3
"""
Sync Notion Elements database to tokens.json

This script:
1. Queries Notion for Memory Token elements (Image, Audio, Video, Audio+Image types)
2. Parses SF_ fields from Description/Text field
3. Checks filesystem for image/audio/video assets
4. Runs a semantic validation pass (memory types, ratings, duplicates,
   RFID<->file alignment) and prints a summary
5. Generates tokens.json with proper structure (atomic write)

Failure posture (E8): any non-complete Notion fetch (HTTP error, missing
`results`, broken pagination) aborts with exit code 1 — NO tokens.json
write, NO prune, NO manifest. Use --force to override.

Flags:
  --force    proceed with partial Notion data despite fetch failures (DANGEROUS)
  --prune    actually delete orphaned asset files (default: report only)
  --dry-run  fetch + validate only; write nothing, delete nothing
"""

import argparse
import requests
import json
import os
import re
import sys
import time
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

# Local helper used to emit the ESP32-consumable asset manifest.
sys.path.insert(0, str(Path(__file__).resolve().parent))
import generate_asset_manifest  # noqa: E402

# Load environment variables from .env file if present
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).parent.parent / '.env'
    if env_path.exists():
        load_dotenv(env_path)
except ImportError:
    # dotenv not installed, will use system environment variables
    pass

# Notion API setup
NOTION_TOKEN = os.environ.get("NOTION_TOKEN")
if not NOTION_TOKEN:
    print("Error: NOTION_TOKEN not found")
    print("Please either:")
    print("  1. Add NOTION_TOKEN to .env file in project root, OR")
    print("  2. Set environment variable: export NOTION_TOKEN='your_token_here'")
    exit(1)

ELEMENTS_DATABASE_ID = "18c2f33d-583f-8020-91bc-d84c7dd94306"
CHARACTERS_DATABASE_ID = "18c2f33d-583f-8060-a6ab-de32ff06bca2"

# File paths (relative to ALN-Ecosystem root)
# scripts/ lives one level below the repo root; resolve to ALN-Ecosystem/.
ECOSYSTEM_ROOT = Path(__file__).resolve().parent.parent
ASSETS_ROOT = ECOSYSTEM_ROOT / "aln-memory-scanner/assets"
ASSETS_IMAGES = ASSETS_ROOT / "images"
ASSETS_AUDIO = ASSETS_ROOT / "audio"
VIDEOS_DIR = ECOSYSTEM_ROOT / "backend/public/videos"
TOKENS_JSON = ECOSYSTEM_ROOT / "ALN-TokenData/tokens.json"
# NOTE: BMPs/WAVs are no longer copied into the ESP32 SD-card tree. The CYD
# scanner now syncs them wirelessly from the backend at boot; the canonical
# asset set lives only at ASSETS_ROOT. See CLAUDE.md "ESP32 Asset Sync
# Issues" section for operational details.

# Notion API headers
headers = {
    "Authorization": f"Bearer {NOTION_TOKEN}",
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json"
}

# Shared scoring config — source of truth for valid SF_MemoryType values.
SCORING_CONFIG_PATH = ECOSYSTEM_ROOT / "ALN-TokenData/scoring-config.json"
# Fallback when scoring-config.json is unavailable (matches docs/SCORING_LOGIC.md).
DEFAULT_VALID_MEMORY_TYPES = frozenset({"Personal", "Business", "Technical", "Mention", "Party"})

# Notion request hardening (F-TOOL-20)
REQUEST_TIMEOUT = 30  # seconds per request
MAX_RETRIES = 3       # retries on 429/5xx/network errors (4 attempts total)


class NotionFetchError(Exception):
    """Raised when a Notion fetch cannot be verified complete (F-TOOL-01)."""


def _notion_post(url, json_data):
    """POST to the Notion API with timeout, and retry w/ backoff on 429/5xx.

    Honors Retry-After when present. Raises NotionFetchError on persistent
    failure or any non-retryable non-200 status (auth error, bad DB id, ...).
    """
    last_err = None
    for attempt in range(MAX_RETRIES + 1):
        retry_after = None
        try:
            resp = requests.post(url, headers=headers, json=json_data, timeout=REQUEST_TIMEOUT)
        except requests.RequestException as e:
            last_err = f"network error: {e}"
        else:
            if resp.status_code == 429 or 500 <= resp.status_code < 600:
                last_err = f"HTTP {resp.status_code}"
                retry_after = resp.headers.get("Retry-After")
            elif resp.status_code != 200:
                raise NotionFetchError(f"HTTP {resp.status_code}: {resp.text[:300]}")
            else:
                try:
                    return resp.json()
                except ValueError as e:
                    raise NotionFetchError(f"invalid JSON response: {e}")
        if attempt < MAX_RETRIES:
            try:
                delay = float(retry_after) if retry_after else 2 ** attempt
            except ValueError:
                delay = 2 ** attempt
            print(f"  ... retrying after {last_err} (attempt {attempt + 2}/{MAX_RETRIES + 1}, waiting {delay:.0f}s)")
            time.sleep(delay)
    raise NotionFetchError(f"giving up after {MAX_RETRIES + 1} attempts: {last_err}")


def _query_database_all(database_id, base_query=None, post=None, force=False):
    """Paginate a Notion database query to VERIFIED completion.

    Raises NotionFetchError if any page fails, lacks `results`, or pagination
    cannot complete (has_more without next_cursor). With force=True, prints a
    loud warning and returns whatever partial results were accumulated.
    """
    post = post or _notion_post
    query_data = dict(base_query or {})
    all_results = []
    has_more = True
    start_cursor = None

    while has_more:
        if start_cursor:
            query_data["start_cursor"] = start_cursor
        try:
            data = post(f"https://api.notion.com/v1/databases/{database_id}/query", query_data)
            if "results" not in data:
                raise NotionFetchError(f"response missing 'results': {str(data)[:300]}")
            all_results.extend(data["results"])
            has_more = data.get("has_more", False)
            start_cursor = data.get("next_cursor")
            if has_more and not start_cursor:
                raise NotionFetchError("has_more=true but no next_cursor — pagination cannot complete")
        except NotionFetchError as e:
            if force:
                print(f"⚠️  --force: continuing with {len(all_results)} partial result(s) despite fetch failure: {e}")
                return all_results
            raise
    return all_results


def join_rich_text(blocks, page_name="<unknown>"):
    """Concatenate Notion rich_text blocks, tolerating non-text blocks.

    Mention/equation blocks have no `text` key (F-TOOL-18) — they are skipped
    with a warning naming the page instead of crashing with a KeyError.
    """
    parts = []
    for block in blocks:
        text = block.get("text")
        if not isinstance(text, dict) or "content" not in text:
            btype = block.get("type", "unknown")
            print(f"⚠️  Skipping non-text rich_text block (type={btype}) on page '{page_name}'")
            continue
        parts.append(text["content"])
    return "".join(parts)


# Display dimensions
WIDTH = 240
HEIGHT = 320

# Font size configurations for measure-and-fit algorithm: (font_size, line_height)
# Tries largest first, steps down until content fits
FONT_SIZES = [(18, 24), (17, 23), (16, 21), (15, 20), (14, 19), (13, 18), (12, 16), (11, 15), (10, 14)]

# Character name pattern: 2+ uppercase letters, optionally followed by 's or 's
CHARACTER_NAME_PATTERN = re.compile(r"\b[A-Z]{2,}(?:'[sS])?\b")

# Timestamp patterns - text format from Notion is: "TOKEN_CODE - TIMESTAMP - CONTENT"
# We strip the token code first, then extract timestamp
# Time: 1:22am, 11:32PM, 04:18PM, 03:52AM, ??:??AM (unknown), etc.
TIME_PATTERN = re.compile(r'^((?:\d{1,2}|\?\?):(?:\d{2}|\?\?)\s*(?:am|pm|AM|PM)?)\s*[-–]?\s*')
# Date: 05/12/2022, 03/20/2020, 11/10/20, ??/??/?? (unknown), etc.
DATE_PATTERN = re.compile(r'^((?:\d{1,2}|\?\?)/(?:\d{1,2}|\?\?)/(?:\d{2,4}|\?\?))\s*[-–]?\s*')
# Token code prefix pattern: "TAC001 - " or "ALR001 - " etc.
TOKEN_PREFIX_PATTERN = re.compile(r'^[A-Za-z]{2,4}\d{2,4}\s*[-–]\s*', re.IGNORECASE)


def load_font(size, bold=False):
    """Load a font at the specified size."""
    try:
        if bold:
            return ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf", size)
        return ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", size)
    except:
        try:
            if bold:
                return ImageFont.truetype("/usr/share/fonts/truetype/liberation/LiberationMono-Bold.ttf", size)
            return ImageFont.truetype("/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf", size)
        except:
            return ImageFont.load_default()


def extract_timestamp(text):
    """
    Extract timestamp/date from text.

    Notion format is: "TOKEN_CODE - TIMESTAMP - CONTENT"
    We strip the token code first (since it's already shown in header),
    then extract the timestamp.

    Returns:
        Tuple of (timestamp_str, timestamp_type, remaining_text)
        - timestamp_str: The extracted timestamp or None
        - timestamp_type: 'time' (night-of, bright), 'date' (backstory, dim),
                          'unknown' (??/?? format, dim), or None
        - remaining_text: Text with token code and timestamp stripped
    """
    working_text = text

    # First, strip token code prefix if present (e.g., "TAC001 - ")
    prefix_match = TOKEN_PREFIX_PATTERN.match(working_text)
    if prefix_match:
        working_text = working_text[prefix_match.end():]

    # Try time pattern first (more specific)
    time_match = TIME_PATTERN.match(working_text)
    if time_match:
        ts = time_match.group(1).strip()
        # Check if it's unknown (contains ??)
        ts_type = 'unknown' if '??' in ts else 'time'
        return (ts, ts_type, working_text[time_match.end():].strip())

    # Try date pattern
    date_match = DATE_PATTERN.match(working_text)
    if date_match:
        ts = date_match.group(1).strip()
        # Check if it's unknown (contains ??)
        ts_type = 'unknown' if '??' in ts else 'date'
        return (ts, ts_type, working_text[date_match.end():].strip())

    # No timestamp found, but still return text with token code stripped
    return (None, None, working_text)


def wrap_text_with_font(text, max_width, font, draw):
    """
    Word wrap text to fit within max_width using the specified font.

    Returns:
        List of lines
    """
    # Normalize whitespace
    normalized_text = ' '.join(text.split())
    words = normalized_text.split(' ')
    lines = []
    current_line = ''

    for word in words:
        test_line = current_line + (' ' if current_line else '') + word
        bbox = draw.textbbox((0, 0), test_line, font=font)
        text_width = bbox[2] - bbox[0]

        if text_width > max_width and current_line:
            lines.append(current_line)
            current_line = word
        else:
            current_line = test_line

    if current_line:
        lines.append(current_line)

    return lines


def segment_line_for_highlighting(line):
    """
    Split a line into segments for character name highlighting.

    Returns:
        List of (text, is_character_name) tuples
    """
    segments = []
    last_end = 0

    for match in CHARACTER_NAME_PATTERN.finditer(line):
        # Add text before the match (if any)
        if match.start() > last_end:
            segments.append((line[last_end:match.start()], False))
        # Add the character name
        segments.append((match.group(), True))
        last_end = match.end()

    # Add remaining text after last match
    if last_end < len(line):
        segments.append((line[last_end:], False))

    # If no matches, return the whole line as non-highlighted
    if not segments:
        segments.append((line, False))

    return segments


def generate_neurai_display(rfid, text):
    """
    Generate a NeurAI-styled 240x320 BMP display image.

    Features:
    - Header zone with token code and timestamp (left of N logo)
    - Character names (ALL CAPS) highlighted in red
    - Measure-and-fit font optimization for maximum readability

    Args:
        rfid: Token RFID (used for filename and displayed in header)
        text: Summary text to display

    Returns:
        The canonical PWA path (relative to ECOSYSTEM_ROOT) of the written BMP
    """
    # Create image with black background
    img = Image.new('RGB', (WIDTH, HEIGHT), color='#0a0a0a')
    draw = ImageDraw.Draw(img)

    # Load fixed fonts for header and branding
    logo_font = load_font(8, bold=True)
    brand_font = load_font(12, bold=True)
    header_code_font = load_font(14, bold=True)  # Token code font
    header_time_font = load_font(11, bold=False)  # Timestamp font

    # Colors
    text_color = (255, 255, 255)  # White for body text
    name_color = (204, 0, 0)  # Red for character names
    time_color = (255, 255, 255)  # Bright white for times (night-of)
    date_color = (180, 180, 180)  # Dimmer for dates (backstory)
    unknown_color = (140, 140, 140)  # Even dimmer for unknown timestamps (??/??/??)
    logo_color = (204, 0, 0, 102)  # rgba(204, 0, 0, 0.4)
    border_color = (204, 0, 0, 77)  # rgba(204, 0, 0, 0.3)
    brand_color = (204, 0, 0, 153)  # rgba(204, 0, 0, 0.6)
    truncate_color = (204, 0, 0, 204)  # rgba(204, 0, 0, 0.8)

    # Add subtle red glow border
    draw.rectangle([1, 1, WIDTH - 2, HEIGHT - 2], outline=border_color, width=2)

    # === HEADER ZONE (left of logo) ===
    # Available space: x=3 to x=170 (logo starts at x=175), y=3 to y=52 (accent line at y=55)
    # Center the text block (token code + timestamp) within this zone.

    header_left = 3
    header_right = 170  # Leave space before logo
    header_top = 3
    header_bottom = 52  # Leave space before accent line
    header_gap = 6  # Gap between token code and timestamp

    # Extract timestamp from text
    timestamp, timestamp_type, body_text = extract_timestamp(text)

    # Measure text dimensions
    token_code = rfid.upper()
    code_bbox = draw.textbbox((0, 0), token_code, font=header_code_font)
    code_width = code_bbox[2] - code_bbox[0]
    code_height = code_bbox[3] - code_bbox[1]

    if timestamp:
        ts_bbox = draw.textbbox((0, 0), timestamp, font=header_time_font)
        ts_width = ts_bbox[2] - ts_bbox[0]
        ts_height = ts_bbox[3] - ts_bbox[1]
        total_height = code_height + header_gap + ts_height
        max_width = max(code_width, ts_width)
    else:
        ts_width = 0
        ts_height = 0
        total_height = code_height
        max_width = code_width

    # Calculate centered position
    available_width = header_right - header_left
    available_height = header_bottom - header_top
    header_x = header_left + (available_width - max_width) // 2
    header_y = header_top + (available_height - total_height) // 2

    # Render token code (uppercase, bold, red like the logo)
    draw.text((header_x, header_y), token_code, fill=(204, 0, 0), font=header_code_font)

    # Render timestamp below token code (if present)
    if timestamp:
        # Color based on type: time=bright, date=dim, unknown=dimmer
        if timestamp_type == 'time':
            ts_color = time_color
        elif timestamp_type == 'unknown':
            ts_color = unknown_color
        else:  # date
            ts_color = date_color
        ts_y = header_y + code_height + header_gap
        draw.text((header_x, ts_y), timestamp, fill=ts_color, font=header_time_font)

    # === N LOGO (top right corner) ===
    logo = [
        '███╗░░██╗',
        '████╗░██║',
        '██╔██╗██║',
        '██║╚████║',
        '██║░╚███║',
        '╚═╝░░╚══╝'
    ]
    for i, line in enumerate(logo):
        draw.text((WIDTH - 65, 10 + i * 7), line, fill=logo_color, font=logo_font)

    # Red accent line below header
    draw.line([(10, 55), (WIDTH - 10, 55)], fill=(204, 0, 0), width=2)

    # === BODY TEXT with measure-and-fit optimization ===
    padding = 15
    max_width = WIDTH - (padding * 2)
    start_y = 62
    bottom_reserve = 18  # Space for branding

    # Calculate available lines for each font size
    def max_lines_for_height(line_height):
        return int((HEIGHT - start_y - bottom_reserve) / line_height)

    # Find optimal font size using measure-and-fit
    selected_font = None
    selected_line_height = None
    display_lines = None

    for font_size, line_height in FONT_SIZES:
        test_font = load_font(font_size)
        lines = wrap_text_with_font(body_text, max_width, test_font, draw)
        max_lines = max_lines_for_height(line_height)

        if len(lines) <= max_lines:
            # This font size fits!
            selected_font = test_font
            selected_line_height = line_height
            display_lines = lines
            break

    # Fallback: use smallest font with truncation
    if selected_font is None:
        selected_font = load_font(10)
        selected_line_height = 14
        lines = wrap_text_with_font(body_text, max_width, selected_font, draw)
        max_lines = max_lines_for_height(selected_line_height)
        display_lines = lines[:max_lines]
        needs_truncation = len(lines) > max_lines
    else:
        needs_truncation = False

    # === RENDER BODY TEXT with character highlighting ===
    for i, line in enumerate(display_lines):
        y = start_y + (i * selected_line_height)
        x = padding

        # Segment line for character name highlighting
        segments = segment_line_for_highlighting(line)

        for segment_text, is_name in segments:
            color = name_color if is_name else text_color
            draw.text((x, y), segment_text, fill=color, font=selected_font)
            # Advance x position
            bbox = draw.textbbox((0, 0), segment_text, font=selected_font)
            x += bbox[2] - bbox[0]

    # Add truncation indicator if text was cut off
    if needs_truncation:
        truncate_y = start_y + (len(display_lines) * selected_line_height) + 5
        draw.text((padding, truncate_y), '[...]', fill=truncate_color, font=selected_font)

    # === BOTTOM BRANDING ===
    brand_text = 'N E U R A I'
    bbox = draw.textbbox((0, 0), brand_text, font=brand_font)
    brand_width = bbox[2] - bbox[0]
    brand_x = (WIDTH - brand_width) / 2
    draw.text((brand_x, HEIGHT - 16), brand_text, fill=brand_color, font=brand_font)

    # Save to the single canonical PWA location; the ESP32 pulls this file
    # wirelessly from the backend at boot (see AssetService on device side).
    pwa_path = ASSETS_IMAGES / f"{rfid}.bmp"
    pwa_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(pwa_path, 'BMP')
    return str(pwa_path.relative_to(ECOSYSTEM_ROOT))

def parse_sf_fields(description_text):
    """
    Parse SF_ fields from description text.

    Expected format:
    SF_RFID: [value]
    SF_ValueRating: [value]
    SF_MemoryType: [value]
    SF_Group: [value]
    SF_Summary: [value]
    """
    sf_data = {}

    # Pattern to match SF_FieldName: [value] or SF_FieldName: [ value ]
    patterns = {
        'SF_RFID': r'SF_RFID:\s*\[([^\]]*)\]',
        'SF_ValueRating': r'SF_ValueRating:\s*\[([^\]]*)\]',
        'SF_MemoryType': r'SF_MemoryType:\s*\[([^\]]*)\]',
        'SF_Group': r'SF_Group:\s*\[([^\]]*)\]',
        'SF_Summary': r'SF_Summary:\s*\[([^\]]*)\]',
    }

    for field, pattern in patterns.items():
        match = re.search(pattern, description_text, re.IGNORECASE)
        if match:
            value = match.group(1).strip()

            # Convert to appropriate type
            if field == 'SF_RFID':
                sf_data[field] = value.lower() if value else None
            elif field == 'SF_ValueRating':
                try:
                    sf_data[field] = int(value) if value else None
                except ValueError:
                    sf_data[field] = None
            elif field == 'SF_MemoryType':
                sf_data[field] = value if value else None
            elif field == 'SF_Group':
                sf_data[field] = value if value else ""
            elif field == 'SF_Summary':
                sf_data[field] = value if value else None
        else:
            # Set defaults
            if field == 'SF_RFID':
                sf_data[field] = None
            elif field == 'SF_ValueRating':
                sf_data[field] = None
            elif field == 'SF_MemoryType':
                sf_data[field] = None
            elif field == 'SF_Group':
                sf_data[field] = ""
            elif field == 'SF_Summary':
                sf_data[field] = None

    return sf_data

def find_asset_file(rfid, directory, extensions):
    """
    Find an asset file with given RFID and possible extensions.
    Returns relative path from aln-memory-scanner or None.
    """
    if not rfid:
        return None

    for ext in extensions:
        # Try exact case match
        file_path = directory / f"{rfid}{ext}"
        if file_path.exists():
            # Return relative path from aln-memory-scanner
            if "images" in str(directory):
                return f"assets/images/{rfid}{ext}"
            elif "audio" in str(directory):
                return f"assets/audio/{rfid}{ext}"

    # Try case-insensitive match
    if directory.exists():
        for file in directory.iterdir():
            if file.stem.lower() == rfid.lower() and file.suffix.lower() in [ext.lower() for ext in extensions]:
                # Return relative path
                if "images" in str(directory):
                    return f"assets/images/{file.name}"
                elif "audio" in str(directory):
                    return f"assets/audio/{file.name}"

    return None

def find_video_file(rfid):
    """
    Find a video file in backend/public/videos.
    Returns just the filename (not full path) or None.
    """
    if not rfid:
        return None

    # Try exact case match
    video_path = VIDEOS_DIR / f"{rfid}.mp4"
    if video_path.exists():
        return f"{rfid}.mp4"

    # Try case-insensitive match
    if VIDEOS_DIR.exists():
        for file in VIDEOS_DIR.iterdir():
            if file.stem.lower() == rfid.lower() and file.suffix.lower() == ".mp4":
                return file.name

    return None

def fetch_all_characters(force=False, post=None):
    """Fetch all characters from Notion and build {page_id: name} map.

    Raises NotionFetchError on any incomplete fetch (F-TOOL-07) — a partial
    character map would silently null every token owner.
    """
    all_results = _query_database_all(CHARACTERS_DATABASE_ID, post=post, force=force)

    # Build page_id -> name map
    character_map = {}
    for page in all_results:
        page_id = page["id"]
        name_data = page["properties"].get("Name", {}).get("title", [])
        name = join_rich_text(name_data, "Characters DB entry").strip() or None
        if name:
            # Strip role prefix if present (e.g., "E - Ashe Motoko" → "Ashe Motoko")
            if len(name) > 4 and name[1:4] == ' - ':
                name = name[4:]
            character_map[page_id] = name

    print(f"Loaded {len(character_map)} characters from Notion")
    return character_map

def fetch_all_memory_tokens(force=False, post=None):
    """Fetch all memory token elements from Notion.

    Raises NotionFetchError on any incomplete fetch (F-TOOL-01).
    """
    query_data = {
        "filter": {
            "or": [
                {"property": "Basic Type", "select": {"equals": "Memory Token"}},
                {"property": "Basic Type", "select": {"equals": "Memory Token Audio"}},
                {"property": "Basic Type", "select": {"equals": "Memory Token Video"}},
                {"property": "Basic Type", "select": {"equals": "Memory Token Audio + Image"}}
            ]
        }
    }
    return _query_database_all(ELEMENTS_DATABASE_ID, base_query=query_data, post=post, force=force)

def page_title(page):
    """Best-effort page title (tolerates non-text title blocks)."""
    name_data = page.get("properties", {}).get("Name", {}).get("title", [])
    return join_rich_text(name_data, "<title>") or "Untitled"

def process_token(page, character_map, dry_run=False):
    """Process a single Notion page into a token entry."""
    props = page["properties"]

    # Get Name
    name = page_title(page)

    # Get Basic Type
    basic_type_data = props.get("Basic Type", {}).get("select")
    basic_type = basic_type_data["name"] if basic_type_data else None

    # Get Description/Text (tolerates mention/equation blocks — F-TOOL-18)
    desc_data = props.get("Description/Text", {}).get("rich_text", [])
    description = join_rich_text(desc_data, name) if desc_data else ""

    # Parse SF_ fields
    sf_data = parse_sf_fields(description)

    # Extract only the text BEFORE SF_ fields for display
    display_text = description
    if description:
        # Find the first SF_ field marker
        sf_start = description.find('SF_')
        if sf_start > 0:
            # Get only text before SF_ fields, strip whitespace
            display_text = description[:sf_start].strip()

    if not sf_data.get('SF_RFID'):
        print(f"⚠️  Skipping {name}: No SF_RFID found in description")
        return None

    rfid = sf_data['SF_RFID']

    # Generate NeurAI display BMP if display text exists
    generated_bmp = False
    if display_text and display_text.strip():
        if dry_run:
            print(f"   [dry-run] would generate NeurAI display for {rfid}")
        else:
            try:
                generate_neurai_display(rfid, display_text)
                print(f"   Generated NeurAI display for {rfid}")
                generated_bmp = True
            except Exception as e:
                print(f"⚠️  Failed to generate NeurAI display for {rfid}: {e}")

    # Find assets
    image_file = find_asset_file(rfid, ASSETS_IMAGES, ['.bmp', '.jpg', '.png', '.jpeg'])
    audio_file = find_asset_file(rfid, ASSETS_AUDIO, ['.mp3', '.wav', '.ogg'])
    video_file = find_video_file(rfid)

    # Use placeholder if no image found and no BMP was generated
    if not image_file and not generated_bmp:
        placeholder_path = ASSETS_IMAGES / "placeholder.bmp"
        if placeholder_path.exists():
            image_file = "assets/images/placeholder.bmp"

    # Build token entry
    token_entry = {
        "image": image_file,
        "audio": audio_file,
        "video": video_file,
        "processingImage": None,  # Default to None
        "SF_RFID": rfid,
        "SF_ValueRating": sf_data.get('SF_ValueRating'),
        "SF_MemoryType": sf_data.get('SF_MemoryType'),
        "SF_Group": sf_data.get('SF_Group', "")
    }

    # Look up character owner from Notion relation
    owner_refs = page["properties"].get("Owner", {}).get("relation", [])
    if owner_refs:
        owner_id = owner_refs[0]["id"]  # First owner (primary)
        token_entry["owner"] = character_map.get(owner_id)
    else:
        token_entry["owner"] = None

    # Add summary field if it exists (optional field)
    if sf_data.get('SF_Summary'):
        token_entry["summary"] = sf_data.get('SF_Summary')

    # Set processingImage only if video exists
    if video_file and image_file:
        token_entry["processingImage"] = image_file
        token_entry["image"] = None  # Video tokens don't have image, only processingImage

    return rfid, token_entry

def load_valid_memory_types(path=None):
    """Load valid SF_MemoryType values from scoring-config.json typeMultipliers.

    UNKNOWN is excluded — it's the backend's bucket for invalid types, never
    a legitimate authored value. Falls back to the documented defaults when
    the config is missing/unreadable.
    """
    path = path or SCORING_CONFIG_PATH
    try:
        with open(path) as f:
            cfg = json.load(f)
        types = set(cfg.get("typeMultipliers", {}).keys()) - {"UNKNOWN"}
        if types:
            return types
        print(f"⚠️  {path} has no typeMultipliers — falling back to defaults")
    except (OSError, ValueError) as e:
        print(f"⚠️  Could not load scoring config ({e}) — falling back to default memory types")
    return set(DEFAULT_VALID_MEMORY_TYPES)


def validate_tokens(tokens, valid_memory_types):
    """Semantic validation pass (F-TOOL-08). Returns a list of warning strings.

    Warnings only — authoring problems should be loud but must not block a
    sync (the backend tolerates them; it just scores UNKNOWN types at 0x).
    """
    warnings = []
    for rfid, token in sorted(tokens.items()):
        mem_type = token.get("SF_MemoryType")
        if mem_type is None:
            warnings.append(f"{rfid}: SF_MemoryType missing — token will score 0x (UNKNOWN)")
        elif mem_type not in valid_memory_types:
            warnings.append(
                f"{rfid}: SF_MemoryType '{mem_type}' not in scoring-config typeMultipliers "
                f"({', '.join(sorted(valid_memory_types))}) — token will score 0x"
            )
        rating = token.get("SF_ValueRating")
        if rating is None:
            warnings.append(f"{rfid}: SF_ValueRating missing or non-numeric")
        elif not 1 <= rating <= 5:
            warnings.append(f"{rfid}: SF_ValueRating {rating} outside valid range 1-5")
    return warnings


# Asset files that are never tokens (kept out of alignment warnings).
ALIGNMENT_EXEMPT_STEMS = frozenset({"placeholder", "idle-loop"})


def check_asset_alignment(tokens, images_dir=None, audio_dir=None, videos_dir=None):
    """RFID<->file alignment check folded in from compare_rfid_with_files (E11).

    Reports: (a) asset files whose stem matches no token SF_RFID (likely an
    RFID/filename mismatch; images/audio would also be prune candidates), and
    (b) tokens with no assets at all.
    """
    images_dir = images_dir if images_dir is not None else ASSETS_IMAGES
    audio_dir = audio_dir if audio_dir is not None else ASSETS_AUDIO
    videos_dir = videos_dir if videos_dir is not None else VIDEOS_DIR

    warnings = []
    token_ids = {t.lower() for t in tokens}
    for dirpath, label in ((images_dir, "image"), (audio_dir, "audio"), (videos_dir, "video")):
        if not dirpath.exists():
            continue
        for f in sorted(dirpath.iterdir()):
            if not f.is_file():
                continue
            stem = f.stem.lower()
            if stem in ALIGNMENT_EXEMPT_STEMS or stem == "manifest":
                continue
            if stem not in token_ids:
                warnings.append(
                    f"{label} file '{f.name}' matches no token SF_RFID "
                    f"(possible RFID/filename mismatch)"
                )
    for rfid, token in sorted(tokens.items()):
        has_asset = any(token.get(k) for k in ("image", "audio", "video", "processingImage"))
        if not has_asset:
            warnings.append(f"{rfid}: no assets found on disk (image/audio/video all missing)")
    return warnings


def write_tokens_json(path, tokens):
    """Atomically write tokens.json (tmp + fsync + replace — F-TOOL-10).

    A crash mid-write can never leave a truncated tokens.json for the
    backend and three scanners to choke on.
    """
    path = Path(path)
    tmp = path.with_name(path.name + ".tmp")
    try:
        with tmp.open("w") as f:
            json.dump(tokens, f, indent=2)
            f.flush()
            os.fsync(f.fileno())
        tmp.replace(path)
    except Exception:
        try:
            tmp.unlink(missing_ok=True)
        except OSError:
            pass
        raise


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description="Sync Notion Elements database to tokens.json")
    parser.add_argument(
        "--force", action="store_true",
        help="proceed with partial Notion data despite fetch failures (DANGEROUS: "
             "may shrink tokens.json; combine with --prune only if you are sure)")
    parser.add_argument(
        "--prune", action="store_true",
        help="actually delete orphaned asset files (default: report what would be deleted)")
    parser.add_argument(
        "--dry-run", action="store_true",
        help="fetch + validate only: no tokens.json write, no BMP generation, no prune, no manifest")
    return parser.parse_args(argv)


def main(argv=None):
    args = parse_args(argv)

    print("=" * 60)
    print("Syncing Notion Elements to tokens.json")
    if args.dry_run:
        print("(DRY RUN — nothing will be written or deleted)")
    print("=" * 60)
    print()

    # Verify directories exist. sd-card-deploy is no longer a write target
    # (images/audio now sync wirelessly to the ESP32 from these canonical
    # locations).
    print("Checking directories...")
    for path, name in [
        (ASSETS_IMAGES, "aln-memory-scanner/assets/images"),
        (ASSETS_AUDIO, "aln-memory-scanner/assets/audio"),
        (VIDEOS_DIR, "backend/public/videos"),
    ]:
        if path.exists():
            print(f"✓ {name}")
        else:
            print(f"✗ {name} (NOT FOUND)")
    print()

    # Fetch from Notion. ANY incomplete fetch aborts before a single byte is
    # written or deleted (E8 failure posture). --force overrides.
    try:
        print("Fetching memory tokens from Notion...")
        pages = fetch_all_memory_tokens(force=args.force)
        print(f"Found {len(pages)} memory token elements in Notion")
        print()

        print("Fetching characters from Notion...")
        character_map = fetch_all_characters(force=args.force)
        print()
    except NotionFetchError as e:
        print()
        print(f"✗ ABORTING: Notion fetch incomplete: {e}")
        print("  Nothing was written or deleted (no tokens.json write, no prune, no manifest).")
        print("  Re-run when Notion is reachable, or use --force to sync partial data (DANGEROUS).")
        sys.exit(1)

    if not character_map:
        print("⚠️  WARNING: characters fetch returned EMPTY — every token owner will be null!")
        print("   Check the Characters database ID and integration permissions.")
        print()

    # Process tokens
    tokens = {}
    skipped = []
    rfid_sources = {}        # rfid -> first page title (duplicate detection, F-TOOL-21)
    duplicate_warnings = []

    print("Processing tokens...")
    for page in pages:
        result = process_token(page, character_map, dry_run=args.dry_run)
        name = page_title(page)
        if result:
            rfid, token_entry = result
            if rfid in rfid_sources:
                duplicate_warnings.append(
                    f"duplicate SF_RFID '{rfid}' on pages '{rfid_sources[rfid]}' and '{name}' "
                    f"— last processed wins, the other page's data is DISCARDED"
                )
            else:
                rfid_sources[rfid] = name
            tokens[rfid] = token_entry

            # Log what was found (show actual filenames)
            assets = []
            if token_entry["image"]:
                assets.append(token_entry["image"])
            if token_entry["audio"]:
                assets.append(token_entry["audio"])
            if token_entry["video"]:
                assets.append(token_entry["video"])
            if token_entry["processingImage"]:
                assets.append(f"processingImage: {token_entry['processingImage']}")

            assets_str = ", ".join(assets) if assets else "no assets"
            print(f"✓ {rfid}: {name} ({assets_str})")
        else:
            skipped.append(name)

    print()
    print(f"Processed {len(tokens)} tokens")
    if skipped:
        print(f"Skipped {len(skipped)} tokens without SF_RFID:")
        for name in skipped:
            print(f"  - {name}")
    print()

    # Sort tokens by RFID for cleaner output
    sorted_tokens = dict(sorted(tokens.items()))

    # ── Validation summary (pre-write): semantic checks + RFID<->file alignment ──
    validation_warnings = []
    validation_warnings.extend(duplicate_warnings)
    validation_warnings.extend(validate_tokens(sorted_tokens, load_valid_memory_types()))
    validation_warnings.extend(check_asset_alignment(sorted_tokens))

    print("-" * 60)
    print("Validation summary")
    print("-" * 60)
    if validation_warnings:
        for w in validation_warnings:
            print(f"  ⚠️  {w}")
        print(f"  {len(validation_warnings)} warning(s) — review before the next game session.")
    else:
        print("  ✓ No issues found")
    print()

    # Safety check: warn if token count dropped significantly
    if TOKENS_JSON.exists():
        with open(TOKENS_JSON) as f:
            existing_count = len(json.load(f))
        if len(sorted_tokens) < existing_count * 0.5:
            print(f"⚠️  WARNING: Only {len(sorted_tokens)} tokens found (existing file has {existing_count}). Possible Notion data problem.")

    if args.dry_run:
        print(f"[dry-run] Would write {len(sorted_tokens)} tokens to {TOKENS_JSON}")
        removed = generate_asset_manifest.prune_orphans(ASSETS_ROOT, sorted_tokens.keys(), dry_run=True)
        for p in removed:
            print(f"[dry-run] Would remove orphan {p.relative_to(ECOSYSTEM_ROOT)}")
        print("[dry-run] Would regenerate asset manifest")
        print()
        print("=" * 60)
        print(f"✓ Dry run complete ({len(sorted_tokens)} tokens, nothing written)")
        print("=" * 60)
        return

    # Write to tokens.json (atomic: tmp + fsync + replace)
    print(f"Writing to {TOKENS_JSON}...")
    write_tokens_json(TOKENS_JSON, sorted_tokens)

    # Prune orphan BMPs/audio for tokens no longer in Notion. Runs ONLY after
    # a verifiably complete fetch reached this point. DEFAULT is dry-run
    # reporting (E8) — pass --prune to actually delete. `placeholder.bmp` is
    # preserved via generate_asset_manifest.EXEMPT_STEMS.
    print()
    if args.prune:
        print("Pruning orphaned asset files...")
        removed = generate_asset_manifest.prune_orphans(ASSETS_ROOT, sorted_tokens.keys())
        if removed:
            for p in removed:
                print(f"  - removed orphan {p.relative_to(ECOSYSTEM_ROOT)}")
            print(f"Removed {len(removed)} orphan asset file(s).")
        else:
            print("No orphans found.")
    else:
        print("Checking for orphaned asset files (report only — pass --prune to delete)...")
        removed = generate_asset_manifest.prune_orphans(ASSETS_ROOT, sorted_tokens.keys(), dry_run=True)
        if removed:
            for p in removed:
                print(f"  - would remove orphan {p.relative_to(ECOSYSTEM_ROOT)}")
            print(f"{len(removed)} orphan(s) found. Re-run with --prune to delete them.")
        else:
            print("No orphans found.")

    # Emit the asset manifest consumed by the ESP32 CYD scanner at boot.
    print()
    print("Writing asset manifest...")
    manifest = generate_asset_manifest.build_manifest(ASSETS_ROOT)
    manifest_path = generate_asset_manifest.write_manifest(ASSETS_ROOT, manifest)
    print(
        f"Wrote {manifest_path.relative_to(ECOSYSTEM_ROOT)} "
        f"(images={len(manifest['images'])}, audio={len(manifest['audio'])})"
    )

    print()
    print("=" * 60)
    print(f"✓ Successfully synced {len(sorted_tokens)} tokens to tokens.json")
    print("=" * 60)

if __name__ == "__main__":
    main()
