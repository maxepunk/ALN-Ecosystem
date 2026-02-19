#!/usr/bin/env python3
"""
Sync Notion Elements database to tokens.json

This script:
1. Queries Notion for Memory Token elements (Image, Audio, Video, Audio+Image types)
2. Parses SF_ fields from Description/Text field
3. Checks filesystem for image/audio/video assets
4. Generates tokens.json with proper structure
"""

import requests
import json
import os
import re
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

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
ECOSYSTEM_ROOT = Path("/home/maxepunk/projects/AboutLastNight/ALN-Ecosystem")
ASSETS_IMAGES = ECOSYSTEM_ROOT / "aln-memory-scanner/assets/images"
ASSETS_AUDIO = ECOSYSTEM_ROOT / "aln-memory-scanner/assets/audio"
VIDEOS_DIR = ECOSYSTEM_ROOT / "backend/public/videos"
TOKENS_JSON = ECOSYSTEM_ROOT / "ALN-TokenData/tokens.json"
ESP32_SD_IMAGES = ECOSYSTEM_ROOT / "arduino-cyd-player-scanner/sd-card-deploy/images"

# Notion API headers
headers = {
    "Authorization": f"Bearer {NOTION_TOKEN}",
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json"
}

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
        Tuple of (pwa_path, esp32_path) for generated files
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

    # Save to both PWA and ESP32 locations
    pwa_path = ASSETS_IMAGES / f"{rfid}.bmp"
    esp32_path = ESP32_SD_IMAGES / f"{rfid}.bmp"

    # Ensure directories exist
    pwa_path.parent.mkdir(parents=True, exist_ok=True)
    esp32_path.parent.mkdir(parents=True, exist_ok=True)

    # Save as 24-bit BMP
    img.save(pwa_path, 'BMP')
    img.save(esp32_path, 'BMP')

    return (str(pwa_path.relative_to(ECOSYSTEM_ROOT)),
            str(esp32_path.relative_to(ECOSYSTEM_ROOT)))

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

def fetch_all_characters():
    """Fetch all characters from Notion and build {page_id: name} map."""
    all_results = []
    has_more = True
    start_cursor = None

    while has_more:
        query_data = {}
        if start_cursor:
            query_data["start_cursor"] = start_cursor

        resp = requests.post(
            f"https://api.notion.com/v1/databases/{CHARACTERS_DATABASE_ID}/query",
            headers=headers,
            json=query_data
        )
        data = resp.json()

        if "results" not in data:
            print(f"Error fetching characters: {data}")
            break

        all_results.extend(data["results"])
        has_more = data.get("has_more", False)
        start_cursor = data.get("next_cursor")

    # Build page_id -> name map
    character_map = {}
    for page in all_results:
        page_id = page["id"]
        name_data = page["properties"].get("Name", {}).get("title", [])
        name = name_data[0]["text"]["content"].strip() if name_data else None
        if name:
            # Strip role prefix if present (e.g., "E - Ashe Motoko" → "Ashe Motoko")
            if len(name) > 4 and name[1:4] == ' - ':
                name = name[4:]
            character_map[page_id] = name

    print(f"Loaded {len(character_map)} characters from Notion")
    return character_map

def fetch_all_memory_tokens():
    """Fetch all memory token elements from Notion."""
    query_data = {
        "filter": {
            "or": [
                {"property": "Basic Type", "select": {"equals": "Memory Token"}},
                {"property": "Basic Type", "select": {"equals": "Memory Token Image"}},
                {"property": "Basic Type", "select": {"equals": "Memory Token Audio"}},
                {"property": "Basic Type", "select": {"equals": "Memory Token Video"}},
                {"property": "Basic Type", "select": {"equals": "Memory Token Audio + Image"}}
            ]
        }
    }

    # Fetch all pages with pagination
    all_results = []
    has_more = True
    start_cursor = None

    while has_more:
        if start_cursor:
            query_data["start_cursor"] = start_cursor

        resp = requests.post(
            f"https://api.notion.com/v1/databases/{ELEMENTS_DATABASE_ID}/query",
            headers=headers,
            json=query_data
        )
        data = resp.json()

        if "results" not in data:
            print(f"Error fetching from Notion: {data}")
            break

        all_results.extend(data["results"])
        has_more = data.get("has_more", False)
        start_cursor = data.get("next_cursor")

    return all_results

def process_token(page, character_map):
    """Process a single Notion page into a token entry."""
    props = page["properties"]

    # Get Name
    name_data = props.get("Name", {}).get("title", [])
    name = name_data[0]["text"]["content"] if name_data else "Untitled"

    # Get Basic Type
    basic_type_data = props.get("Basic Type", {}).get("select")
    basic_type = basic_type_data["name"] if basic_type_data else None

    # Get Description/Text
    desc_data = props.get("Description/Text", {}).get("rich_text", [])
    description = ""
    if desc_data:
        description = "".join([block["text"]["content"] for block in desc_data])

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
        try:
            pwa_path, esp32_path = generate_neurai_display(rfid, display_text)
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

def main():
    print("=" * 60)
    print("Syncing Notion Elements to tokens.json")
    print("=" * 60)
    print()

    # Verify directories exist
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

    # Fetch tokens from Notion
    print("Fetching memory tokens from Notion...")
    pages = fetch_all_memory_tokens()
    print(f"Found {len(pages)} memory token elements in Notion")
    print()

    # Fetch character name map for Owner relation lookups
    print("Fetching characters from Notion...")
    character_map = fetch_all_characters()
    print()

    # Process tokens
    tokens = {}
    skipped = []

    print("Processing tokens...")
    for page in pages:
        result = process_token(page, character_map)
        if result:
            rfid, token_entry = result
            tokens[rfid] = token_entry

            # Get name for logging
            name_data = page["properties"].get("Name", {}).get("title", [])
            name = name_data[0]["text"]["content"] if name_data else "Untitled"

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
            name_data = page["properties"].get("Name", {}).get("title", [])
            name = name_data[0]["text"]["content"] if name_data else "Untitled"
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

    # Write to tokens.json
    print(f"Writing to {TOKENS_JSON}...")
    with open(TOKENS_JSON, 'w') as f:
        json.dump(sorted_tokens, f, indent=2)

    print()
    print("=" * 60)
    print(f"✓ Successfully synced {len(sorted_tokens)} tokens to tokens.json")
    print("=" * 60)

if __name__ == "__main__":
    main()
